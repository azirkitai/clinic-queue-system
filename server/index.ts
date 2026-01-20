import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import compression from "compression";
import { createServer } from "http";
import { Server } from "socket.io";
import { registerRoutes, setGlobalIo } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupWebSocket } from "./websocket";
import path from "path";
import fs from "fs";

const app = express();

// Enable gzip compression for all responses (reduces bandwidth by 70%)
app.use(compression({
  level: 6, // Balance between speed and compression
  threshold: 1024, // Only compress responses > 1KB
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Setup object storage static file serving - CRITICAL for media persistence
const PUBLIC_OBJECT_SEARCH_PATHS = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
if (PUBLIC_OBJECT_SEARCH_PATHS) {
  try {
    const paths = JSON.parse(PUBLIC_OBJECT_SEARCH_PATHS);
    if (Array.isArray(paths) && paths.length > 0) {
      const objectStoragePath = paths[0];
      const absolutePath = path.isAbsolute(objectStoragePath) 
        ? objectStoragePath 
        : path.resolve(process.cwd(), objectStoragePath);
      
      // Extract the URL path for mounting
      const urlPath = objectStoragePath.startsWith('/') ? objectStoragePath : `/${objectStoragePath}`;
      
      if (fs.existsSync(absolutePath)) {
        app.use(urlPath, express.static(absolutePath));
        log(`📦 Object storage mounted: ${urlPath} -> ${absolutePath}`, 'system');
      } else {
        log(`⚠️  Object storage directory not found: ${absolutePath}`, 'system');
      }
    }
  } catch (e) {
    // If not JSON, treat as direct path string
    const objectStoragePath = PUBLIC_OBJECT_SEARCH_PATHS;
    const absolutePath = path.isAbsolute(objectStoragePath) 
      ? objectStoragePath 
      : path.resolve(process.cwd(), objectStoragePath);
    
    const urlPath = objectStoragePath.startsWith('/') ? objectStoragePath : `/${objectStoragePath}`;
    
    if (fs.existsSync(absolutePath)) {
      app.use(urlPath, express.static(absolutePath));
      log(`📦 Object storage mounted: ${urlPath}`, 'system');
    }
  }
}

// Session configuration
const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'clinic-management-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false to work with both HTTP and HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // CSRF protection
  },
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create HTTP server and attach Express app
  const httpServer = createServer(app);
  
  // Setup Socket.IO with tenant isolation and heartbeat to detect zombie connections
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" ? false : "*",
      methods: ["GET", "POST"]
    },
    // Heartbeat config to detect dead connections and force reconnect
    pingInterval: 25000,  // Send ping every 25 seconds
    pingTimeout: 10000,   // Wait 10 seconds for pong before considering dead
  });
  
  // Make Socket.IO server globally available for server-authoritative events
  setGlobalIo(io);
  
  // Setup WebSocket handlers with tenant isolation
  setupWebSocket(io);
  
  // Register API routes (but use httpServer instead of app.listen)
  await registerRoutes(app);

  // AUTO-CLEANUP: Delete old completed patients on startup to reduce database size
  // This runs once when server starts to ensure old data doesn't accumulate
  try {
    const { storage } = await import("./storage");
    
    // Get all users and clean up their old completed patients (>24 hours)
    const users = await storage.getUsers();
    let totalCleaned = 0;
    
    for (const user of users) {
      const cleaned = await storage.deleteOldCompletedPatients(user.id, 24);
      totalCleaned += cleaned;
    }
    
    if (totalCleaned > 0) {
      console.log(`[STARTUP CLEANUP] Deleted ${totalCleaned} old completed patients (>24h) across all users`);
    }
  } catch (error) {
    console.error('[STARTUP CLEANUP] Error during cleanup:', error);
    // Don't crash server if cleanup fails
  }

  // AUTO-COMPLETE SCHEDULER: Auto-complete dispensary patients older than 60 minutes (1 hour)
  // Runs every 5 minutes with mutex to prevent overlapping runs
  let isAutoCompleteRunning = false;
  const AUTO_COMPLETE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  
  const runAutoComplete = async () => {
    // Skip if already running (mutex guard)
    if (isAutoCompleteRunning) {
      console.log('[AUTO-COMPLETE] Skipping run - previous run still in progress');
      return;
    }
    
    isAutoCompleteRunning = true;
    const startTime = Date.now();
    
    try {
      const { storage } = await import("./storage");
      
      // Auto-complete old dispensary patients across all tenants
      const results = await storage.autoCompleteOldDispensaryPatients();
      
      // Emit WebSocket events for each completed patient (so frontend updates in real-time)
      for (const result of results) {
        if (result.count > 0) {
          // For each auto-completed patient, emit standard patient:status-updated event
          for (const patientId of result.patientIds) {
            const patient = await storage.getPatient(patientId);
            if (patient) {
              io.to(`clinic:${result.userId}`).emit('patient:status-updated', {
                patient,
                timestamp: Date.now()
              });
            }
          }
          
          // Also invalidate stats and history
          io.to(`clinic:${result.userId}`).emit('cache:invalidate', {
            queries: ['stats', 'history'],
            reason: 'auto-complete-dispensary',
            timestamp: Date.now()
          });
        }
      }
      
      const duration = Date.now() - startTime;
      const totalCompleted = results.reduce((sum, r) => sum + r.count, 0);
      
      if (totalCompleted > 0) {
        console.log(`[AUTO-COMPLETE] Completed ${totalCompleted} patient(s) across ${results.length} clinic(s) in ${duration}ms`);
      }
    } catch (error) {
      console.error('[AUTO-COMPLETE] Scheduler error:', error);
      // Don't crash - just log and continue
    } finally {
      isAutoCompleteRunning = false;
    }
  };
  
  // Run immediately on startup (to catch any patients that became overdue while server was down)
  runAutoComplete();
  
  // Then run every 5 minutes
  setInterval(runAutoComplete, AUTO_COMPLETE_INTERVAL_MS);
  console.log('[AUTO-COMPLETE] Scheduler started - running every 5 minutes');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    log(`WebSocket server ready with tenant isolation`);
  });
})();
