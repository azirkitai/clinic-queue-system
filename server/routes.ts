import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { insertPatientSchema, insertUserSchema, insertTextGroupSchema, insertThemeSchema, insertQrSessionSchema } from "@shared/schema";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";

// Global Socket.IO server instance for server-authoritative events
let globalIo: SocketIOServer | null = null;

export function setGlobalIo(io: SocketIOServer) {
  globalIo = io;
}

// Server build version - changes on every new deploy
// Uses RENDER_GIT_COMMIT (Render's env var) for consistency across instances
// Falls back to startup timestamp for development
const SERVER_VERSION = process.env.RENDER_GIT_COMMIT || 
                       process.env.GIT_COMMIT || 
                       Date.now().toString();
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import gcsRouter from "./gcs";

// Server-side cache for high-frequency read endpoints
// Reduces Neon CPU usage by caching responses for 2-3 seconds
interface CacheEntry {
  data: any;
  timestamp: number;
  userId: string;
}

const apiCache = new Map<string, CacheEntry>();

// Tiered cache TTLs - optimize for different update frequencies
// ✅ NEON BANDWIDTH FIX: Increase cache TTL to reduce database queries
// WebSocket provides instant updates on mutations, so longer cache is safe
// Cache is invalidated on mutations, so longer TTL = less Neon data transfer
const CACHE_TTL_SHORT = 60000;  // ✅ 60s for patient data (was 10s - 6x reduction in DB queries!)
const CACHE_TTL_LONG = 300000;  // ✅ 5 min for rarely changing data (was 60s - 5x reduction!)

// Cache helper with tenant isolation and configurable TTL
function getCached(key: string, userId: string, ttl: number = CACHE_TTL_SHORT): any | null {
  const cacheKey = `${userId}:${key}`;
  const entry = apiCache.get(cacheKey);
  
  if (entry && Date.now() - entry.timestamp < ttl && entry.userId === userId) {
    return entry.data;
  }
  
  // Clean up expired entry
  if (entry) {
    apiCache.delete(cacheKey);
  }
  
  return null;
}

function setCache(key: string, userId: string, data: any): void {
  const cacheKey = `${userId}:${key}`;
  apiCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    userId
  });
}

// Debounce timers for cache invalidation (batch rapid mutations)
const invalidateTimers = new Map<string, NodeJS.Timeout>();
const INVALIDATE_DEBOUNCE_MS = 300; // 300ms debounce to batch rapid mutations

function invalidateCache(userId: string, pattern?: string, immediate: boolean = false): void {
  const timerKey = `${userId}:${pattern || 'all'}`;
  
  // Clear existing debounce timer
  if (invalidateTimers.has(timerKey)) {
    clearTimeout(invalidateTimers.get(timerKey)!);
  }
  
  // Function to actually invalidate
  const doInvalidate = () => {
    for (const [key, entry] of Array.from(apiCache.entries())) {
      if (entry.userId === userId) {
        if (!pattern || key.includes(pattern)) {
          apiCache.delete(key);
        }
      }
    }
    invalidateTimers.delete(timerKey);
  };
  
  // Immediate invalidation for destructive actions (reset, delete)
  if (immediate) {
    doInvalidate();
  } else {
    // Debounced invalidation for updates (batch within 300ms)
    const timer = setTimeout(doInvalidate, INVALIDATE_DEBOUNCE_MS);
    invalidateTimers.set(timerKey, timer);
  }
}

// Periodic cache cleanup (every 10 seconds) - use longest TTL as cleanup threshold
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(apiCache.entries())) {
    if (now - entry.timestamp > CACHE_TTL_LONG) {
      apiCache.delete(key);
    }
  }
}, 10000);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PNG and JPEG files
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Extend Express session types
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string;
    role?: string;
  }
}

// Helper function to sanitize user data (remove sensitive fields)
function sanitizeUser(user: any) {
  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
}

// Auth middleware to check session before any processing
function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Session inactive" });
  }
  next();
}

// QR endpoint validation schemas
const qrAuthorizeSchema = z.object({
  username: z.string().min(1, "Username required"),
  password: z.string().min(1, "Password required")
});

const qrFinalizeSchema = z.object({
  tvVerifier: z.string().min(1, "TV verifier required")
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Middleware for traffic logging
  app.use((req, res, next) => {
    if (process.env.TRAFFIC_LOGGING !== 'true') {
      return next();
    }

    const start = Date.now();
    const { method, path } = req;

    // Capture the original res.json to calculate size
    const oldJson = res.json;
    res.json = function (body) {
      const duration = Date.now() - start;
      const size = Buffer.byteLength(JSON.stringify(body));
      console.log(`REQ ${method} ${path} ${res.statusCode} size=${size} bytes dur=${duration}ms`);
      return oldJson.call(this, body);
    };

    next();
  });

  // Rate limiting to prevent reconnection storms and spam
  // 300 requests per minute per IP (supports 10+ TVs with multiple polling queries)
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute (10 TVs x 5 queries x 2 polls/min = 100 + buffer)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down" },
    skip: (req) => {
      // Skip rate limiting for non-API routes and lightweight TV endpoints
      if (!req.path.startsWith('/api/')) return true;
      // Exempt high-frequency TV endpoints from general rate limit
      if (req.path === '/api/patients/tv') return true;
      if (req.path === '/api/themes/active') return true;
      if (req.path === '/api/text-groups/active') return true;
      if (req.path === '/api/settings') return true;
      if (req.path === '/api/settings/tv') return true; // ✅ TV settings exempt
      return false;
    }
  });

  // Stricter rate limit for heavy/legacy endpoints only
  const heavyEndpointLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute  
    max: 30, // 30 requests per minute for legacy endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Rate limit exceeded for this endpoint. Use /api/patients/tv instead." }
  });

  // Apply general rate limiting to API routes (with exemptions above)
  app.use('/api/', apiLimiter);

  // Server version endpoint for auto-refresh
  // Clients check this periodically and reload if version changed (new deploy)
  app.get("/api/version", (req, res) => {
    // Prevent caching to ensure clients always get fresh version
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({ version: SERVER_VERSION });
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      const user = await storage.authenticateUser(username, password);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      // Regenerate session ID to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ error: "Internal server error" });
        }
        
        // Store user info in session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            clinicName: "",
            clinicLocation: ""
          }
        });
      });
      
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true, message: "Logout successful" });
    });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }

      const username = req.session.username!;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const bcrypt = await import("bcryptjs");
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ error: "Current password invalid" });
      }

      await storage.updateUser(user.id, { password: newPassword });

      res.json({ 
        success: true, 
        message: "Password successfully updated" 
      });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Google Cloud Storage routes
  app.use("/api/gcs", requireAuth, gcsRouter);

  // Legacy Object Storage routes (kept for backward compatibility)
  // Get presigned upload URL for media files
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Serve uploaded objects (public files)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error downloading object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Serve standalone QR auth page (bypass React SPA routing/caching issues)
  app.get("/qr-auth/:id", (req, res) => {
    const htmlPath = path.join(process.cwd(), 'server', 'qr-auth.html');
    res.sendFile(htmlPath);
  });

  // QR Authentication routes
  app.post("/api/qr/init", async (req, res) => {
    try {
      // Don't generate tvVerifier yet - will be created when phone authorizes
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

      const qrSession = await storage.createQrSession({
        status: "pending",
        tvVerifierHash: "", // Will be set during authorization
        authorizedUserId: null,
        expiresAt,
        usedAt: null,
        metadata: null
      });

      // Clean up old sessions periodically
      await storage.expireOldQrSessions();

      res.json({
        qrId: qrSession.id,
        expiresAt: expiresAt.toISOString(),
        qrUrl: `${req.protocol}://${req.get('host')}/qr-auth/${qrSession.id}`
      });
    } catch (error) {
      console.error("Error creating QR session:", error);
      res.status(500).json({ error: "Failed to create QR session" });
    }
  });

  app.post("/api/qr/:id/authorize", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body with Zod
      const validationResult = qrAuthorizeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.issues.map(issue => issue.message)
        });
      }
      
      const { username, password } = validationResult.data;

      // Authenticate user
      const user = await storage.authenticateUser(username, password);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Generate 6-digit TV verifier code (shown on phone, entered on desktop)
      const tvVerifier = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
      const tvVerifierHash = createHash('sha256').update(tvVerifier).digest('hex');

      // Authorize QR session and store the verifier hash
      const authorizedSession = await storage.authorizeQrSession(id, user.id, tvVerifierHash);
      if (!authorizedSession) {
        return res.status(404).json({ error: "QR session not found or expired" });
      }

      // Set session for PHONE (will redirect to TV display)
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      // Force session save to ensure cookie is set before response
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // SERVER-AUTHORITATIVE: Emit authorization event to QR room (desktop listens)
      if (globalIo) {
        const qrRoom = `qr:${id}`;
        globalIo.to(qrRoom).emit("qr:authorization_complete", {
          qrId: id,
          user: { username: user.username, id: user.id },
          message: "QR successfully authenticated - please enter code from phone",
          timestamp: new Date()
        });
        // console.log removed (emoji)
      }

      // Return 6-digit code to PHONE to display
      res.json({ 
        success: true, 
        message: "QR successfully authenticated",
        tvVerifier, // Phone displays this code
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error("Error authorizing QR session:", error);
      res.status(500).json({ error: "Failed to authenticate QR session" });
    }
  });

  app.post("/api/qr/:id/finalize", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body with Zod
      const validationResult = qrFinalizeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.issues.map(issue => issue.message)
        });
      }
      
      const { tvVerifier } = validationResult.data;

      const result = await storage.finalizeQrSession(id, tvVerifier);
      if (!result.success) {
        return res.status(400).json({ error: "Failed to authenticate QR - session invalid or expired" });
      }

      if (result.userId) {
        // Set session for TV display
        req.session.userId = result.userId;
        const user = await storage.getUser(result.userId);
        if (user) {
          req.session.username = user.username;
          req.session.role = user.role;
        }

        // SERVER-AUTHORITATIVE: Emit finalization event to QR room
        if (globalIo) {
          const qrRoom = `qr:${id}`;
          globalIo.to(qrRoom).emit("qr:login_complete", {
            qrId: id,
            userId: result.userId,
            message: "Login QR selesai - TV perlu refresh untuk apply session",
            timestamp: new Date()
          });
          // console.log removed (emoji)
          
          // Clean up the QR room after a short delay
          setTimeout(() => {
            globalIo?.socketsLeave(qrRoom);
            console.log(`🧹 QR room ${qrRoom} cleaned up by server`);
          }, 3000);
        }
      }

      res.json({ 
        success: true, 
        message: "QR login successful",
        userId: result.userId
      });
    } catch (error) {
      console.error("Error finalizing QR session:", error);
      res.status(500).json({ error: "Failed to complete QR session" });
    }
  });
  
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "No active session" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          clinicName: "",
          clinicLocation: ""
        }
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Setup static file serving for uploaded media
  const PUBLIC_OBJECT_SEARCH_PATHS = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  if (PUBLIC_OBJECT_SEARCH_PATHS) {
    try {
      let publicPath = 'uploads/public';
      try {
        const paths = JSON.parse(PUBLIC_OBJECT_SEARCH_PATHS);
        if (Array.isArray(paths) && paths.length > 0) {
          publicPath = paths[0].startsWith('/') ? paths[0].substring(1) : paths[0];
        }
      } catch (e) {
        publicPath = PUBLIC_OBJECT_SEARCH_PATHS.startsWith('/') ? PUBLIC_OBJECT_SEARCH_PATHS.substring(1) : PUBLIC_OBJECT_SEARCH_PATHS;
      }
      
      // Serve static files from the object storage path
      app.use(`/${publicPath}`, express.static(publicPath));
      console.log(`Static file serving enabled for: /${publicPath} -> ${publicPath}`);
    } catch (error) {
      console.error("Error setting up static file serving:", error);
    }
  }
  
  // Patient registration routes
  
  // Create new patient
  app.post("/api/patients", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      console.log("[PATIENT] POST /api/patients - Request body:", req.body);
      
      // Add userId from session to patient data
      const patientDataWithUser = {
        ...req.body,
        userId: req.session.userId
      };
      
      console.log("[PATIENT] Patient data with user:", patientDataWithUser);
      
      const patientData = insertPatientSchema.parse(patientDataWithUser);
      console.log("[PATIENT] Parsed patient data:", patientData);
      
      const patient = await storage.createPatient(patientData);
      console.log("[PATIENT] Created patient:", patient);
      
      // Invalidate cache after creating patient
      invalidateCache(req.session.userId);
      
      // Emit WebSocket event for real-time updates
      if (globalIo) {
        globalIo.to(`clinic:${req.session.userId}`).emit('patient:created', {
          patient,
          timestamp: Date.now()
        });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error creating patient:", error);
      res.status(400).json({ error: "Invalid patient data" });
    }
  });

  // Get all patients
  app.get("/api/patients", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const patients = await storage.getPatients(req.session.userId);
      res.json(patients);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  // Get active patients (excludes completed patients for lighter payloads)
  app.get("/api/patients/active", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check server-side cache first (2.5s TTL)
      const cached = getCached('active-patients', req.session.userId);
      if (cached !== null) {
        return res.json(cached);
      }
      
      const activePatients = await storage.getActivePatients(req.session.userId);
      
      // Cache the result
      setCache('active-patients', req.session.userId, activePatients);
      
      res.json(activePatients);
    } catch (error) {
      console.error("Error fetching active patients:", error);
      res.status(500).json({ error: "Failed to fetch active patients" });
    }
  });

  // Get TV display patients (lightweight DTO - 85% payload reduction!)
  // Excludes: trackingHistory, metadata, most timestamps (reduces ~70KB → ~10KB for 10 patients)
  // Includes: id, name, number, status, isPriority, windowId, windowName, calledAt, requeueReason
  app.get("/api/patients/tv", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check server-side cache first (2.5s TTL)
      const cached = getCached('tv-patients', req.session.userId);
      if (cached !== null) {
        return res.json(cached);
      }
      
      const tvPatients = await storage.getTvPatients(req.session.userId);
      
      // Cache the result (same TTL as active patients)
      setCache('tv-patients', req.session.userId, tvPatients);
      
      res.json(tvPatients);
    } catch (error) {
      console.error("Error fetching TV patients:", error);
      res.status(500).json({ error: "Failed to fetch TV patients" });
    }
  });

  // Get today's patients
  app.get("/api/patients/today", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const patients = await storage.getPatientsByDate(today, req.session.userId);
      res.json(patients);
    } catch (error) {
      console.error("Error fetching today's patients:", error);
      res.status(500).json({ error: "Failed to fetch today's patients" });
    }
  });

  // Get next patient number
  app.get("/api/patients/next-number", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const nextNumber = await storage.getNextPatientNumber(req.session.userId);
      res.json({ nextNumber });
    } catch (error) {
      console.error("Error getting next patient number:", error);
      res.status(500).json({ error: "Failed to get next patient number" });
    }
  });

  // Update patient status (for queue management)
  app.patch("/api/patients/:id/status", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const { status, windowId, requeueReason } = req.body;
      
      // Only clear windowId for requeue status (completed status handled by storage layer)
      const finalWindowId = (status === "requeue") ? null : windowId;
      
      const patient = await storage.updatePatientStatus(id, status, req.session.userId, finalWindowId, requeueReason);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Update window assignment if needed
      if (windowId && status === "called") {
        await storage.updateWindowPatient(windowId, req.session.userId, id);
      } else if (status === "completed" || status === "requeue" || status === "dispensary") {
        // Clear patient from window
        const windows = await storage.getWindows(req.session.userId);
        const currentWindow = windows.find(w => w.currentPatientId === id);
        if (currentWindow) {
          await storage.updateWindowPatient(currentWindow.id, req.session.userId, undefined);
        }
      }
      
      // Invalidate cache immediately for status transitions (bypass 300ms debounce for real-time TV updates)
      const isStatusTransition = status === "completed" || status === "requeue" || status === "dispensary";
      invalidateCache(req.session.userId, undefined, isStatusTransition);
      
      // Emit WebSocket event for real-time updates
      if (globalIo) {
        globalIo.to(`clinic:${req.session.userId}`).emit('patient:status-updated', {
          patient,
          timestamp: Date.now()
        });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error updating patient status:", error);
      res.status(500).json({ error: "Failed to update patient status" });
    }
  });

  // Toggle patient priority
  app.patch("/api/patients/:id/priority", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const patient = await storage.togglePatientPriority(id, req.session.userId);
      
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Invalidate cache after priority toggle
      invalidateCache(req.session.userId);
      
      // Emit WebSocket event for real-time updates
      if (globalIo) {
        globalIo.to(`clinic:${req.session.userId}`).emit('patient:priority-updated', {
          patient,
          timestamp: Date.now()
        });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error toggling patient priority:", error);
      res.status(500).json({ error: "Failed to toggle patient priority" });
    }
  });

  // Delete patient
  app.delete("/api/patients/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const deleted = await storage.deletePatient(id, req.session.userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Invalidate cache immediately after deletion (destructive action)
      invalidateCache(req.session.userId, undefined, true);
      
      // Emit WebSocket event for real-time updates
      if (globalIo) {
        globalIo.to(`clinic:${req.session.userId}`).emit('patient:deleted', {
          patientId: id,
          timestamp: Date.now()
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting patient:", error);
      res.status(500).json({ error: "Failed to delete patient" });
    }
  });

  // Auto-complete dispensary patients older than 60 minutes (1 hour)
  app.post("/api/patients/auto-complete-dispensary", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Get all patients ready for dispensary
      const allPatients = await storage.getPatients(req.session.userId);
      const dispensaryPatients = allPatients.filter(p => p.readyForDispensary && p.status !== 'completed');
      
      const autoCompletedPatients: string[] = [];
      const SIXTY_MINUTES_MS = 60 * 60 * 1000; // 60 minutes (1 hour) in milliseconds
      
      for (const patient of dispensaryPatients) {
        // Find when patient entered dispensary from trackingHistory
        const trackingHistory = patient.trackingHistory as any[] || [];
        const dispensaryEvent = trackingHistory.find((event: any) => event.action === 'dispensary');
        
        if (dispensaryEvent && dispensaryEvent.timestamp) {
          const dispensaryTime = new Date(dispensaryEvent.timestamp).getTime();
          const currentTime = Date.now();
          const timeDiff = currentTime - dispensaryTime;
          
          // If patient has been in dispensary for more than 60 minutes, auto-complete
          if (timeDiff > SIXTY_MINUTES_MS) {
            console.log(`[AUTO-COMPLETE] Patient ${patient.id} (${patient.name || patient.number}) in dispensary for ${Math.round(timeDiff / 60000)} minutes - auto-completing`);
            
            // Complete the patient (windowId null, no requeueReason)
            await storage.updatePatientStatus(patient.id, 'completed', req.session.userId, null);
            
            // Clear patient from window if assigned
            const windows = await storage.getWindows(req.session.userId);
            const currentWindow = windows.find(w => w.currentPatientId === patient.id);
            if (currentWindow) {
              await storage.updateWindowPatient(currentWindow.id, req.session.userId, undefined);
            }
            
            autoCompletedPatients.push(patient.id);
            
            // Emit WebSocket event for real-time updates
            if (globalIo) {
              const updatedPatient = await storage.getPatient(patient.id);
              globalIo.to(`clinic:${req.session.userId}`).emit('patient:status-updated', {
                patient: updatedPatient,
                timestamp: Date.now()
              });
            }
          }
        }
      }
      
      // Invalidate cache if any patients were auto-completed
      if (autoCompletedPatients.length > 0) {
        invalidateCache(req.session.userId);
      }
      
      res.json({ 
        success: true, 
        autoCompletedCount: autoCompletedPatients.length,
        patientIds: autoCompletedPatients,
        message: `${autoCompletedPatients.length} patient(s) auto-completed from dispensary`
      });
    } catch (error) {
      console.error("[AUTO-COMPLETE] Error:", error);
      res.status(500).json({ error: "Failed to auto-complete dispensary patients" });
    }
  });

  // Manual reset/clear queue (for 24-hour clinics)
  app.post("/api/patients/reset-queue", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Delete ALL today's patients (hard delete)
      const todayDeleted = await storage.deleteAllTodayPatients(req.session.userId);
      
      // ALSO delete ALL completed patients (reduce database size & bandwidth)
      const completedDeleted = await storage.deleteAllCompletedPatients(req.session.userId);
      
      const totalDeleted = todayDeleted + completedDeleted;
      
      // Clear all windows
      const windows = await storage.getWindows(req.session.userId);
      for (const window of windows) {
        if (window.currentPatientId) {
          await storage.updateWindowPatient(window.id, req.session.userId, undefined);
        }
      }
      
      console.log(`[RESET QUEUE] Deleted ${todayDeleted} today's patients + ${completedDeleted} old completed patients = ${totalDeleted} total for user ${req.session.userId}`);
      
      // Invalidate all cache immediately after reset (destructive action)
      invalidateCache(req.session.userId, undefined, true);
      
      // Emit WebSocket event for real-time updates
      if (globalIo) {
        globalIo.to(`clinic:${req.session.userId}`).emit('queue:reset', {
          timestamp: Date.now()
        });
      }
      
      res.json({ 
        success: true, 
        deletedCount: totalDeleted,
        todayDeleted,
        completedDeleted,
        message: `Queue reset complete. ${totalDeleted} patient(s) deleted (${todayDeleted} today + ${completedDeleted} old completed). Next number starts from 1.` 
      });
    } catch (error) {
      console.error("[RESET QUEUE] Error:", error);
      res.status(500).json({ error: "Failed to reset queue" });
    }
  });

  // Force refresh all connected clients (admin only)
  // This broadcasts a WebSocket event that triggers page reload on all browsers
  app.post("/api/system/force-refresh", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Broadcast force-refresh to ALL clients in this clinic
      if (globalIo) {
        globalIo.to(`clinic:${req.session.userId}`).emit('system:force-refresh', {
          timestamp: Date.now(),
          triggeredBy: req.session.userId
        });
        console.log(`[FORCE REFRESH] Triggered by user ${req.session.userId} - broadcasting to all clinic clients`);
      }
      
      res.json({ 
        success: true, 
        message: "Force refresh signal sent to all connected clients. They will reload within 2 seconds." 
      });
    } catch (error) {
      console.error("[FORCE REFRESH] Error:", error);
      res.status(500).json({ error: "Failed to send force refresh signal" });
    }
  });

  // Clear completed patients (manual cleanup to reduce database size)
  app.post("/api/patients/clear-completed", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Delete ALL completed patients
      const deletedCount = await storage.deleteAllCompletedPatients(req.session.userId);
      
      console.log(`[CLEAR COMPLETED] Deleted ${deletedCount} completed patients for user ${req.session.userId}`);
      
      // Invalidate cache immediately after clearing completed (destructive action)
      invalidateCache(req.session.userId, undefined, true);
      
      res.json({ 
        success: true, 
        deletedCount,
        message: `${deletedCount} completed patient(s) deleted. Database cleaned up successfully.` 
      });
    } catch (error) {
      console.error("[CLEAR COMPLETED] Error:", error);
      res.status(500).json({ error: "Failed to clear completed patients" });
    }
  });

  // Clear old completed patients (cleanup patients older than X hours)
  app.post("/api/patients/clear-old-completed", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { hoursOld = 24 } = req.body; // Default to 24 hours
      
      // Validate hoursOld
      if (typeof hoursOld !== 'number' || hoursOld < 1 || hoursOld > 720) {
        return res.status(400).json({ error: "hoursOld must be between 1 and 720 (30 days)" });
      }
      
      // Delete completed patients older than specified hours
      const deletedCount = await storage.deleteOldCompletedPatients(req.session.userId, hoursOld);
      
      console.log(`[CLEAR OLD] Deleted ${deletedCount} completed patients older than ${hoursOld}h for user ${req.session.userId}`);
      
      // Invalidate cache immediately after clearing old completed (destructive action)
      invalidateCache(req.session.userId, undefined, true);
      
      res.json({ 
        success: true, 
        deletedCount,
        hoursOld,
        message: `${deletedCount} completed patient(s) older than ${hoursOld} hours deleted.` 
      });
    } catch (error) {
      console.error("[CLEAR OLD] Error:", error);
      res.status(500).json({ error: "Failed to clear old completed patients" });
    }
  });

  // User management routes
  
  // Get all users - Admin only
  app.get("/api/users", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check if user is admin
      if (req.session.role !== 'admin') {
        return res.status(403).json({ error: "Akses ditolak - hanya admin boleh lihat senarai pengguna" });
      }
      
      const users = await storage.getUsers();
      
      // Remove sensitive data like passwords from response
      const sanitizedUsers = users.map(sanitizeUser);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Create new user - Admin only
  app.post("/api/users", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check if user is admin
      if (req.session.role !== 'admin') {
        return res.status(403).json({ error: "Access denied - only admin can add users" });
      }
      
      const { username, password, role } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const user = await storage.createUser({
        username,
        password,
        role: role || 'user'
      });
      
      // Remove sensitive data from response
      const sanitizedUser = sanitizeUser(user);
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Get specific user (Self only - tenant isolation)
  app.get("/api/users/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      
      // TENANT SECURITY: Users can only view their own account
      if (req.session.userId !== id) {
        return res.status(403).json({ error: "Access denied - can only view own profile" });
      }
      
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove sensitive data like password from response
      const sanitizedUser = sanitizeUser(user);
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Update user (Self only - tenant isolation)
  app.put("/api/users/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const updates = req.body;
      
      // TENANT SECURITY: Users can only update their own account
      if (req.session.userId !== id) {
        return res.status(403).json({ error: "Access denied - can only update own profile" });
      }
      
      // SECURITY: Validate and whitelist allowed update fields
      const allowedFields = ['username', 'clinicName', 'clinicLocation'];
      const validatedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedFields.includes(key))
      );
      
      if (Object.keys(validatedUpdates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      const user = await storage.updateUser(id, validatedUpdates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Toggle user status - REMOVED for tenant security
  // In multi-tenant system, users cannot disable their own clinic accounts
  app.patch("/api/users/:id/status", async (req, res) => {
    res.status(403).json({ 
      error: "Operation not allowed - clinic account cannot deactivate itself"
    });
  });

  // Delete user
  app.delete("/api/users/:id", async (req, res) => {
    try {
      console.log("[DELETE USER] Request:", {
        sessionUserId: req.session.userId,
        targetUserId: req.params.id
      });

      // Check authentication
      if (!req.session.userId) {
        console.log("[DELETE USER] ERROR: No session userId");
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      
      // Prevent self-deletion
      if (req.session.userId === id) {
        console.log("[DELETE USER] ERROR: Attempting self-deletion");
        return res.status(403).json({ 
          error: "Cannot delete your own account"
        });
      }
      
      // Get the user to be deleted
      const targetUser = await storage.getUser(id);
      console.log("[DELETE USER] Target user:", targetUser);
      
      if (!targetUser) {
        console.log("[DELETE USER] ERROR: User not found");
        return res.status(404).json({ error: "User not found" });
      }
      
      // Prevent deleting the default admin account
      if (targetUser.username === "admin" && targetUser.role === "admin") {
        console.log("[DELETE USER] ERROR: Attempting to delete default admin");
        return res.status(403).json({ 
          error: "Cannot delete default admin account"
        });
      }
      
      // If deleting an admin, check if there are other admins
      if (targetUser.role === "admin") {
        const allUsers = await storage.getUsers();
        const adminCount = allUsers.filter(u => u.role === "admin").length;
        console.log("[DELETE USER] Admin count:", adminCount);
        
        if (adminCount <= 1) {
          console.log("[DELETE USER] ERROR: Cannot delete last admin");
          return res.status(403).json({ 
            error: "Cannot delete the last admin user"
          });
        }
      }
      
      console.log("[DELETE USER] Proceeding with deletion");
      const success = await storage.deleteUser(id);
      if (!success) {
        console.log("[DELETE USER] ERROR: Delete failed - user not found");
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log("[DELETE USER] SUCCESS: User deleted");
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("[DELETE USER] ERROR:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Get user display configuration
  app.get("/api/users/:id/display-config", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      
      // SECURITY: Only allow users to view their own config
      if (req.session.userId !== id) {
        return res.status(403).json({ error: "Not allowed to access other user data" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get all user-specific display configuration data using proper userId filtering
      const [settings, themes, media, textGroups] = await Promise.all([
        storage.getSettings(id),
        storage.getThemes(id), 
        storage.getMedia(id),
        storage.getTextGroups(id)
      ]);

      const displayConfig = {
        user: {
          id: user.id,
          username: user.username,
          clinicName: "",
          clinicLocation: ""
        },
        settings,
        themes,
        media,
        textGroups,
        stats: {
          totalSettings: settings.length,
          totalThemes: themes.length,
          totalMedia: media.length,
          totalTextGroups: textGroups.length,
          activeTheme: themes.find(t => t.isActive)?.name || "None"
        }
      };

      res.json(displayConfig);
    } catch (error) {
      console.error("Error fetching user display config:", error);
      res.status(500).json({ error: "Failed to fetch display configuration" });
    }
  });

  // Get all windows
  app.get("/api/windows", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check server-side cache first (2.5s TTL)
      const cached = getCached('windows', req.session.userId);
      if (cached !== null) {
        return res.json(cached);
      }
      
      const windows = await storage.getWindows(req.session.userId);
      
      // Cache the result
      setCache('windows', req.session.userId, windows);
      
      res.json(windows);
    } catch (error) {
      console.error("Error fetching windows:", error);
      res.status(500).json({ error: "Failed to fetch windows" });
    }
  });

  // Create new window
  app.post("/api/windows", async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Window name is required" });
      }
      
      // Get user ID from session
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const window = await storage.createWindow({ name, userId });
      
      // Invalidate cache after creating window
      invalidateCache(userId);
      
      // Emit WebSocket event for real-time updates
      if (globalIo) {
        globalIo.to(`clinic:${userId}`).emit('window:created', {
          window,
          timestamp: Date.now()
        });
      }
      
      res.status(201).json(window);
    } catch (error) {
      console.error("Error creating window:", error);
      res.status(500).json({ error: "Failed to create window" });
    }
  });

  // Update window
  app.put("/api/windows/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Window name is required" });
      }
      
      const window = await storage.updateWindow(id, name, req.session.userId);
      if (!window) {
        return res.status(404).json({ error: "Window not found" });
      }
      
      // Invalidate cache after updating window
      invalidateCache(req.session.userId);
      
      // Emit WebSocket event for real-time updates
      if (globalIo) {
        globalIo.to(`clinic:${req.session.userId}`).emit('window:updated', {
          window,
          timestamp: Date.now()
        });
      }
      
      res.json(window);
    } catch (error) {
      console.error("Error updating window:", error);
      res.status(500).json({ error: "Failed to update window" });
    }
  });

  // Delete window
  app.delete("/api/windows/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      
      const success = await storage.deleteWindow(id, req.session.userId);
      if (!success) {
        return res.status(400).json({ error: "Cannot delete window - window not found or currently occupied" });
      }
      
      // Invalidate cache immediately after deleting window (destructive action)
      invalidateCache(req.session.userId, undefined, true);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting window:", error);
      res.status(500).json({ error: "Failed to delete window" });
    }
  });

  // Toggle window status
  app.patch("/api/windows/:id/status", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      
      const window = await storage.toggleWindowStatus(id, req.session.userId);
      if (!window) {
        return res.status(404).json({ error: "Window not found" });
      }
      
      // Invalidate cache after toggling window status
      invalidateCache(req.session.userId);
      
      res.json(window);
    } catch (error) {
      console.error("Error toggling window status:", error);
      res.status(500).json({ error: "Failed to toggle window status" });
    }
  });

  // Update window patient assignment
  app.patch("/api/windows/:id/patient", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const { patientId } = req.body;
      
      const window = await storage.updateWindowPatient(id, req.session.userId, patientId);
      if (!window) {
        return res.status(404).json({ error: "Window not found" });
      }
      
      // Invalidate cache after updating window patient
      invalidateCache(req.session.userId);
      
      // Emit WebSocket event for real-time updates
      if (globalIo) {
        globalIo.to(`clinic:${req.session.userId}`).emit('window:patient-updated', {
          window,
          timestamp: Date.now()
        });
      }
      
      res.json(window);
    } catch (error) {
      console.error("Error updating window patient:", error);
      res.status(500).json({ error: "Failed to update window patient" });
    }
  });

  // Dashboard routes
  
  // Get dashboard statistics
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check server-side cache first (2.5s TTL)
      const cached = getCached('dashboard-stats', req.session.userId);
      if (cached !== null) {
        return res.json(cached);
      }
      
      const stats = await storage.getDashboardStats(req.session.userId);
      
      // Cache the result
      setCache('dashboard-stats', req.session.userId, stats);
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // ⚠️ LEGACY ENDPOINT - Use /api/patients/tv instead (85% smaller payload)
  // Apply stricter rate limit to prevent bandwidth waste
  app.get("/api/dashboard/current-call", heavyEndpointLimiter, async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check server-side cache first (5s TTL - longer for legacy endpoint)
      const cached = getCached('current-call', req.session.userId, 5000);
      if (cached !== null) {
        return res.json(cached);
      }
      
      // Fetch from database - return lightweight version only
      const currentCall = await storage.getCurrentCall(req.session.userId);
      
      // Return lightweight payload (not full patient object)
      const result = currentCall ? {
        id: currentCall.id,
        name: currentCall.name,
        number: currentCall.number,
        status: currentCall.status,
        windowId: currentCall.windowId,
        calledAt: currentCall.calledAt
      } : null;
      
      // Cache the result
      setCache('current-call', req.session.userId, result);
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching current call:", error);
      res.status(500).json({ error: "Failed to fetch current call" });
    }
  });

  // ⚠️ LEGACY ENDPOINT - Use /api/patients/tv instead (85% smaller payload)
  // Apply stricter rate limit to prevent bandwidth waste
  app.get("/api/dashboard/history", heavyEndpointLimiter, async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 10); // Max 10 items
      
      // Check server-side cache first (5s TTL - longer for legacy endpoint)
      const cacheKey = `history-${limit}`;
      const cached = getCached(cacheKey, req.session.userId, 5000);
      if (cached !== null) {
        return res.json(cached);
      }
      
      const history = await storage.getRecentHistory(req.session.userId, limit);
      
      // Return lightweight payload (not full patient objects)
      const lightHistory = history.map(p => ({
        id: p.id,
        name: p.name,
        number: p.number,
        status: p.status,
        windowId: p.windowId,
        calledAt: p.calledAt
      }));
      
      // Cache the result
      setCache(cacheKey, req.session.userId, lightHistory);
      
      res.json(lightHistory);
    } catch (error) {
      console.error("Error fetching recent history:", error);
      res.status(500).json({ error: "Failed to fetch recent history" });
    }
  });

  // Settings routes

  // ✅ TV-optimized settings endpoint (lightweight - ~2KB instead of ~11KB)
  // Only returns settings keys that TV display actually uses
  const TV_SETTINGS_KEYS = new Set([
    // Marquee
    'enableMarquee', 'marqueeText', 'marqueeColor', 'marqueeBackgroundColor',
    'marqueeBackgroundMode', 'marqueeBackgroundGradient', 'marqueeTextMode', 'marqueeTextGradient',
    // Modal
    'modalBackgroundColor', 'modalBorderColor', 'modalTextColor',
    // Clinic (NOTE: clinicLogo EXCLUDED - it's 211KB base64! TV gets it via /api/media with caching)
    'showClinicLogo', 'clinicName',
    // Header
    'headerBackgroundMode', 'headerBackgroundColor', 'headerBackgroundGradient',
    'headerTextMode', 'headerTextColor', 'headerTextGradient',
    // Clinic name text
    'clinicNameTextMode', 'clinicNameTextColor', 'clinicNameTextGradient',
    // Call section
    'callBackgroundMode', 'callBackgroundColor', 'callBackgroundGradient',
    'callNameTextMode', 'callNameTextColor', 'callNameTextGradient',
    // Window text
    'windowTextMode', 'windowTextColor', 'windowTextGradient',
    // Prayer times
    'prayerTimesBackgroundMode', 'prayerTimesBackgroundColor', 'prayerTimesBackgroundGradient',
    'prayerTimesTextMode', 'prayerTimesTextColor', 'prayerTimesTextGradient', 'prayerTimesHighlightColor',
    // Weather
    'weatherBackgroundMode', 'weatherBackgroundColor', 'weatherBackgroundGradient',
    'weatherTextMode', 'weatherTextColor', 'weatherTextGradient',
    // Queue
    'queueBackgroundMode', 'queueBackgroundColor', 'queueBackgroundGradient',
    'queueTextMode', 'queueTextColor', 'queueTextGradient',
    'queueItemBackgroundMode', 'queueItemBackgroundColor', 'queueItemBackgroundGradient',
    // History
    'historyNameColor', 'historyNameMode', 'historyNameGradient',
    // Sound
    'enableSound', 'volume', 'presetKey',
  ]);

  app.get("/api/settings/tv", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check cache (60s TTL - TV settings rarely change)
      const cached = getCached('settings-tv', req.session.userId, 60000);
      if (cached !== null) {
        return res.json(cached);
      }
      
      // ✅ CRITICAL FIX: Use getTvSettings() to fetch ONLY needed keys at DATABASE level
      // This prevents 200KB clinicLogo from being transferred from Neon on every request
      // Previous: getSettings() fetched ALL settings (~220KB), then filtered client-side
      // Now: getTvSettings() fetches only ~40 keys (~10KB) directly from database
      const tvSettingsKeys = Array.from(TV_SETTINGS_KEYS);
      const tvSettings = await storage.getTvSettings(req.session.userId, tvSettingsKeys);
      
      setCache('settings-tv', req.session.userId, tvSettings);
      res.json(tvSettings);
    } catch (error) {
      console.error("Error fetching TV settings:", error);
      res.status(500).json({ error: "Failed to fetch TV settings" });
    }
  });

  // Get all settings
  app.get("/api/settings", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check server-side cache first (30s TTL - rarely changes)
      const cached = getCached('settings', req.session.userId, CACHE_TTL_LONG);
      if (cached !== null) {
        return res.json(cached);
      }
      
      const settings = await storage.getSettings(req.session.userId);
      
      // Cache the result
      setCache('settings', req.session.userId, settings);
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Get settings by category
  app.get("/api/settings/category/:category", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { category } = req.params;
      const settings = await storage.getSettingsByCategory(category, req.session.userId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings by category:", error);
      res.status(500).json({ error: "Failed to fetch settings by category" });
    }
  });

  // ✅ Dedicated clinicLogo endpoint with HTTP caching (saves 211KB per request!)
  // Browser will cache for 1 hour, only re-fetch when logo actually changes
  app.get("/api/settings/logo", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const logoSetting = await storage.getSetting('clinicLogo', req.session.userId);
      const logo = logoSetting?.value || '';
      
      // Set HTTP cache headers - cache for 1 hour
      res.set('Cache-Control', 'public, max-age=3600');
      res.json({ logo });
    } catch (error) {
      console.error("Error fetching clinic logo:", error);
      res.status(500).json({ error: "Failed to fetch clinic logo" });
    }
  });

  // Get specific setting
  app.get("/api/settings/:key", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { key } = req.params;
      const setting = await storage.getSetting(key, req.session.userId);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  // Create or update setting
  app.put("/api/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const { value, category } = req.body;

      if (!value || !category) {
        return res.status(400).json({ error: "Value and category are required" });
      }

      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Try to update existing setting first
      let setting = await storage.updateSetting(key, value, req.session.userId);
      
      // If setting doesn't exist, create new one
      if (!setting) {
        setting = await storage.setSetting(key, value, category, req.session.userId);
      }

      // Invalidate cache after updating setting
      invalidateCache(req.session.userId);
      
      // Notify all connected clients about settings update
      if (globalIo) {
        globalIo.emit('settings:updated', { key, timestamp: Date.now() });
      }

      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Update multiple settings
  app.put("/api/settings", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { settings } = req.body;

      if (!settings || !Array.isArray(settings)) {
        return res.status(400).json({ error: "Settings array is required" });
      }

      const updatedSettings = [];
      for (const settingData of settings) {
        const { key, value, category } = settingData;
        if (!key || !value || !category) {
          continue; // Skip invalid settings
        }

        // Try to update existing setting first
        let setting = await storage.updateSetting(key, value, req.session.userId);
        
        // If setting doesn't exist, create new one
        if (!setting) {
          setting = await storage.setSetting(key, value, category, req.session.userId);
        }
        
        updatedSettings.push(setting);
      }

      // Invalidate cache after updating settings
      invalidateCache(req.session.userId);
      
      // Notify all connected clients about settings update
      if (globalIo) {
        globalIo.emit('settings:updated', { 
          keys: updatedSettings.map(s => s.key),
          timestamp: Date.now() 
        });
      }

      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating multiple settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Delete setting
  app.delete("/api/settings/:key", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { key } = req.params;
      const deleted = await storage.deleteSetting(key, req.session.userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      // Invalidate cache immediately after deleting setting (destructive action)
      invalidateCache(req.session.userId, undefined, true);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({ error: "Failed to delete setting" });
    }
  });

  // Media management routes
  
  // Get all media files
  app.get("/api/media", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const media = await storage.getActiveMedia(req.session.userId);
      res.json(media);
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  // Get media by ID (metadata only)
  // ✅ OPTIMIZED: Uses getMediaMetadataById() to avoid fetching 3-4MB base64 data from Neon
  app.get("/api/media/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      // ✅ Use optimized method that excludes base64 data at DATABASE level
      const media = await storage.getMediaMetadataById(id, req.session.userId);
      
      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }
      
      // Return metadata (data is already NULL from optimized query)
      const { data, ...metadata } = media;
      res.json(metadata);
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ error: "Failed to fetch media" });
    }
  });

  // Serve media file (binary data) from database
  app.get("/api/media/:id/file", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Public endpoint - no auth required for serving files (TV display needs this)
      const media = await storage.getMediaById(id);
      
      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }
      
      // If legacy URL-based media, redirect to external URL
      if (media.url && !media.data) {
        return res.redirect(media.url);
      }
      
      // Serve base64-encoded data
      if (!media.data) {
        return res.status(404).json({ error: "Media file not found" });
      }
      
      // MEMORY-OPTIMIZED: Stream decode in chunks to prevent OOM
      // Convert base64 to buffer - this is unavoidable but we process immediately
      const buffer = Buffer.from(media.data, 'base64');
      
      // Set appropriate headers
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      
      // Send and immediately free buffer from memory
      res.send(buffer);
      
      // Help GC by clearing reference (Node.js will handle cleanup)
      // This is a hint to the garbage collector
    } catch (error) {
      console.error("Error serving media file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Upload media file directly to database (base64-encoded)
  // MEMORY-OPTIMIZED: 2MB limit to prevent Replit OOM (512MB RAM constraint)
  app.post("/api/media/upload", requireAuth, multer({
    storage: multer.memoryStorage(),
    limits: { 
      fileSize: 2 * 1024 * 1024, // 2MB limit (safe for 512MB Replit RAM)
      files: 1
    },
    fileFilter: (req, file, cb) => {
      // Only allow images
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  }).single('file'), async (req, res) => {
    const uploadStartTime = Date.now();
    try {
      console.log('[MEDIA UPLOAD] Request received:', {
        hasFile: !!req.file,
        userId: req.session.userId,
        contentType: req.headers['content-type']
      });

      if (!req.file) {
        console.log('[MEDIA UPLOAD] ERROR: No file in request');
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { name } = req.body;
      const filename = req.file.originalname;
      const mimeType = req.file.mimetype;
      const size = req.file.size;
      
      console.log('[MEDIA UPLOAD] File details:', {
        filename,
        mimeType,
        size: `${(size / 1024).toFixed(2)}KB`,
        name: name || 'unnamed'
      });
      
      // Additional validation
      if (size > 2 * 1024 * 1024) {
        console.log('[MEDIA UPLOAD] ERROR: File too large:', size);
        return res.status(400).json({ error: "File size exceeds 2MB limit" });
      }
      
      // Convert buffer to base64 (process immediately, don't hold in memory)
      const conversionStart = Date.now();
      const base64Data = req.file.buffer.toString('base64');
      const conversionTime = Date.now() - conversionStart;
      
      console.log('[MEDIA UPLOAD] Base64 conversion:', {
        originalSize: size,
        base64Size: base64Data.length,
        conversionTimeMs: conversionTime
      });
      
      // Clear buffer reference to free memory ASAP
      req.file.buffer = Buffer.alloc(0);
      
      // Determine file type
      let type: 'image' | 'video' | 'audio' = 'image';
      if (mimeType.startsWith('video/')) {
        type = 'video';
      } else if (mimeType.startsWith('audio/')) {
        type = 'audio';
      }

      // Save to database with base64 data
      console.log('[MEDIA UPLOAD] Saving to database...');
      const dbStart = Date.now();
      const media = await storage.createMedia({
        name: name || filename,
        filename,
        url: null, // No external URL, stored in database
        data: base64Data, // Store base64-encoded data
        type,
        mimeType,
        size,
        userId: req.session.userId as string,
      });
      const dbTime = Date.now() - dbStart;
      
      const totalTime = Date.now() - uploadStartTime;
      console.log('[MEDIA UPLOAD] SUCCESS:', {
        mediaId: media.id,
        dbTimeMs: dbTime,
        totalTimeMs: totalTime
      });

      res.status(201).json(media);
    } catch (error: any) {
      const totalTime = Date.now() - uploadStartTime;
      console.error('[MEDIA UPLOAD] ERROR after', totalTime, 'ms:', {
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n')[0]
      });
      
      // Handle multer file size error
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "File size exceeds 2MB limit" });
      }
      
      // Handle file type error
      if (error.message && error.message.includes('Only image files')) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }
      
      // Return detailed error for debugging
      res.status(500).json({ 
        error: "Failed to upload file",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Legacy: Save uploaded media metadata (for backward compatibility)
  app.post("/api/media/save-uploaded", requireAuth, async (req, res) => {
    try {
      const { uploadURL, filename, name, mimeType, size } = req.body;
      
      if (!uploadURL || !filename) {
        return res.status(400).json({ error: "Upload URL and filename are required" });
      }

      let finalUrl = uploadURL;

      // Check if this is a GCS URL (from new GCS upload) or legacy Replit object storage URL
      if (uploadURL.startsWith('https://storage.googleapis.com/')) {
        // GCS URL - use directly, already public
        finalUrl = uploadURL;
      } else {
        // Legacy Replit Object Storage - apply ACL policy
        const objectStorageService = new ObjectStorageService();
        finalUrl = objectStorageService.normalizeObjectEntityPath(uploadURL);

        // Set ACL policy for public access (TV display images)
        await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, {
          owner: req.session.userId as string,
          visibility: "public",
        });
      }

      // Save to database
      const media = await storage.createMedia({
        name: name || filename,
        filename,
        url: finalUrl,
        type: 'image',
        mimeType: mimeType || 'image/jpeg',
        size: size || 0,
        userId: req.session.userId as string,
      });

      res.status(201).json(media);
    } catch (error) {
      console.error("Error saving uploaded media:", error);
      res.status(500).json({ error: "Failed to save media" });
    }
  });

  // Create new media (for now simulated upload)
  app.post("/api/media", async (req, res) => {
    try {
      // Check authentication FIRST, before any processing
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { name, type } = req.body;
      
      if (!name || !type) {
        return res.status(400).json({ error: "Name and type are required" });
      }

      // Simulate file upload data
      const filename = `${name.toLowerCase().replace(/\s+/g, '_')}.${type === 'image' ? 'jpg' : 'mp4'}`;
      const url = `/media/${filename}`;
      const mimeType = type === 'image' ? 'image/jpeg' : 'video/mp4';
      const size = Math.floor(Math.random() * 1000000) + 100000; // Random size between 100KB-1MB

      const media = await storage.createMedia({
        name,
        filename,
        url,
        type: type as 'image' | 'video',
        mimeType,
        size,
        userId: req.session.userId,
      });

      res.status(201).json(media);
    } catch (error) {
      console.error("Error creating media:", error);
      res.status(500).json({ error: "Failed to create media" });
    }
  });

  // Update media (rename)
  app.patch("/api/media/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const media = await storage.updateMedia(id, { name }, req.session.userId);
      
      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }
      
      res.json(media);
    } catch (error) {
      console.error("Error updating media:", error);
      res.status(500).json({ error: "Failed to update media" });
    }
  });

  // Delete media
  app.delete("/api/media/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const deleted = await storage.deleteMedia(id, req.session.userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Media not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting media:", error);
      res.status(500).json({ error: "Failed to delete media" });
    }
  });




  
  // Add test media (for development/testing)
  app.post("/api/media/test", async (req, res) => {
    try {
      const testMedia = [
        {
          name: "Medical Scan Image",
          filename: "scan_image.jpg",
          url: "https://via.placeholder.com/800x600/4f46e5/ffffff?text=Medical+Scan",
          type: 'image' as const,
          mimeType: "image/jpeg",
          size: 145000,
        },
        {
          name: "Clinic Poster",
          filename: "poster.png", 
          url: "https://via.placeholder.com/600x900/10b981/ffffff?text=Clinic+Poster",
          type: 'image' as const,
          mimeType: "image/png",
          size: 230000,
        },
        {
          name: "Health Info Banner",
          filename: "health_banner.jpg",
          url: "https://via.placeholder.com/1200x400/f59e0b/ffffff?text=Health+Information",
          type: 'image' as const,
          mimeType: "image/jpeg", 
          size: 180000,
        },
        {
          name: "Appointment Notice",
          filename: "appointment.png",
          url: "https://via.placeholder.com/400x800/ef4444/ffffff?text=Appointment+Notice",
          type: 'image' as const,
          mimeType: "image/png",
          size: 95000,
        }
      ];

      const createdMedia = [];
      for (const mediaData of testMedia) {
        const media = await storage.createMedia({
          ...mediaData,
          userId: 'system' // Test media for system
        });
        createdMedia.push(media);
      }

      res.json({ 
        success: true, 
        message: `${createdMedia.length} test media items created`,
        media: createdMedia 
      });
    } catch (error) {
      console.error("Error creating test media:", error);
      res.status(500).json({ error: "Failed to create test media" });
    }
  });
  
  // Get active media for display
  app.get("/api/display", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // ✅ OPTIMIZED: Fetch only the 2 specific settings needed instead of ALL settings (~220KB)
      // This reduces Neon data transfer by ~95% per request
      const [mediaTypeSetting, youtubeUrlSetting] = await Promise.all([
        storage.getSetting('dashboardMediaType', req.session.userId),
        storage.getSetting('youtubeUrl', req.session.userId)
      ]);

      const dashboardMediaType = mediaTypeSetting?.value || "own";
      const youtubeUrl = youtubeUrlSetting?.value || "";

      // If YouTube is selected and URL is provided, return YouTube media
      if (dashboardMediaType === "youtube" && youtubeUrl) {
        const youtubeMedia = [{
          id: "youtube-video",
          name: "YouTube Video",
          filename: "youtube-video",
          url: youtubeUrl,
          type: "youtube" as const,
          mimeType: "video/youtube",
          size: 0,
          isActive: true,
          uploadedAt: new Date()
        }];
        res.json(youtubeMedia);
      } else {
        // Otherwise return regular uploaded media
        const activeMedia = await storage.getActiveMedia(req.session.userId);
        // ✅ BANDWIDTH OPTIMIZATION: Exclude base64 data field (frontend loads via /api/media/:id/file)
        const lightweightMedia = activeMedia.map(({ data, ...rest }) => rest);
        res.json(lightweightMedia);
      }
    } catch (error) {
      console.error("Error fetching display media:", error);
      res.status(500).json({ error: "Failed to fetch display media" });
    }
  });

  // Save media items to display (mark as active)
  app.post("/api/display", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { mediaIds } = req.body;
      
      if (!Array.isArray(mediaIds)) {
        return res.status(400).json({ error: "mediaIds must be an array" });
      }

      // First, deactivate all current media
      const allMedia = await storage.getMedia(req.session.userId);
      for (const media of allMedia) {
        if (media.isActive) {
          await storage.updateMedia(media.id, { isActive: false }, req.session.userId);
        }
      }

      // Then activate the selected media
      const updatedMedia = [];
      for (const mediaId of mediaIds) {
        const updated = await storage.updateMedia(mediaId, { isActive: true }, req.session.userId);
        if (updated) {
          updatedMedia.push(updated);
        }
      }

      res.json({ 
        success: true, 
        message: `${updatedMedia.length} media items activated for display`,
        activeMedia: updatedMedia 
      });
    } catch (error) {
      console.error("Error saving media to display:", error);
      res.status(500).json({ error: "Failed to save media to display" });
    }
  });

  // Theme management routes
  
  // Text Groups routes
  
  // Get all text groups
  app.get("/api/text-groups", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const textGroups = await storage.getTextGroups(req.session.userId);
      res.json(textGroups);
    } catch (error) {
      console.error("Error fetching text groups:", error);
      res.status(500).json({ error: "Failed to fetch text groups" });
    }
  });

  // Get active text groups
  app.get("/api/text-groups/active", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check server-side cache first (30s TTL - rarely changes)
      const cached = getCached('active-text-groups', req.session.userId, CACHE_TTL_LONG);
      if (cached !== null) {
        return res.json(cached);
      }
      
      const activeTextGroups = await storage.getActiveTextGroups(req.session.userId);
      
      // Cache the result
      setCache('active-text-groups', req.session.userId, activeTextGroups);
      
      res.json(activeTextGroups);
    } catch (error) {
      console.error("Error fetching active text groups:", error);
      res.status(500).json({ error: "Failed to fetch active text groups" });
    }
  });

  // Get text group by name
  app.get("/api/text-groups/name/:groupName", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { groupName } = req.params;
      const textGroup = await storage.getTextGroupByName(groupName, req.session.userId);
      
      if (!textGroup) {
        return res.status(404).json({ error: "Text group not found" });
      }
      
      res.json(textGroup);
    } catch (error) {
      console.error("Error fetching text group by name:", error);
      res.status(500).json({ error: "Failed to fetch text group" });
    }
  });

  // Get text group by ID
  app.get("/api/text-groups/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const textGroup = await storage.getTextGroupById(id, req.session.userId);
      
      if (!textGroup) {
        return res.status(404).json({ error: "Text group not found" });
      }
      
      res.json(textGroup);
    } catch (error) {
      console.error("Error fetching text group:", error);
      res.status(500).json({ error: "Failed to fetch text group" });
    }
  });

  // Create new text group
  app.post("/api/text-groups", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const textGroupData = insertTextGroupSchema.parse({ ...req.body, userId: req.session.userId });
      const textGroup = await storage.createTextGroup(textGroupData);
      res.status(201).json(textGroup);
    } catch (error) {
      console.error("Error creating text group:", error);
      res.status(400).json({ error: "Invalid text group data" });
    }
  });

  // Update text group
  app.put("/api/text-groups/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const updates = req.body;
      
      const textGroup = await storage.updateTextGroup(id, updates, req.session.userId);
      if (!textGroup) {
        return res.status(404).json({ error: "Text group not found" });
      }
      
      // Notify all connected clients about text group update
      if (globalIo) {
        globalIo.emit('text-groups:updated', { id, timestamp: Date.now() });
      }
      
      res.json(textGroup);
    } catch (error) {
      console.error("Error updating text group:", error);
      res.status(500).json({ error: "Failed to update text group" });
    }
  });

  // Toggle text group status
  app.patch("/api/text-groups/:id/status", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      
      const textGroup = await storage.toggleTextGroupStatus(id, req.session.userId);
      if (!textGroup) {
        return res.status(404).json({ error: "Text group not found" });
      }
      
      // Notify all connected clients about text group status change
      if (globalIo) {
        globalIo.emit('text-groups:updated', { id, timestamp: Date.now() });
      }
      
      res.json(textGroup);
    } catch (error) {
      console.error("Error toggling text group status:", error);
      res.status(500).json({ error: "Failed to toggle text group status" });
    }
  });

  // Delete text group
  app.delete("/api/text-groups/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const deleted = await storage.deleteTextGroup(id, req.session.userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Text group not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting text group:", error);
      res.status(500).json({ error: "Failed to delete text group" });
    }
  });

  // Theme routes
  
  // Get all themes
  app.get("/api/themes", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const themes = await storage.getThemes(req.session.userId);
      res.json(themes);
    } catch (error) {
      console.error("Error fetching themes:", error);
      res.status(500).json({ error: "Failed to fetch themes" });
    }
  });

  // Get active theme
  app.get("/api/themes/active", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      // Check server-side cache first (30s TTL - rarely changes)
      const cached = getCached('active-theme', req.session.userId, CACHE_TTL_LONG);
      if (cached !== null) {
        return res.json(cached);
      }
      
      const activeTheme = await storage.getActiveTheme(req.session.userId);
      
      if (!activeTheme) {
        return res.status(404).json({ error: "No active theme found" });
      }
      
      // Cache the result
      setCache('active-theme', req.session.userId, activeTheme);
      
      res.json(activeTheme);
    } catch (error) {
      console.error("Error fetching active theme:", error);
      res.status(500).json({ error: "Failed to fetch active theme" });
    }
  });

  // Get theme by ID
  app.get("/api/themes/:id", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const { id } = req.params;
      const theme = await storage.getThemeById(id, req.session.userId);
      
      if (!theme) {
        return res.status(404).json({ error: "Theme not found" });
      }
      
      res.json(theme);
    } catch (error) {
      console.error("Error fetching theme:", error);
      res.status(500).json({ error: "Failed to fetch theme" });
    }
  });

  // Create new theme
  app.post("/api/themes", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const themeData = insertThemeSchema.parse({ ...req.body, userId: req.session.userId });
      const theme = await storage.createTheme(themeData);
      res.status(201).json(theme);
    } catch (error) {
      console.error("Error creating theme:", error);
      res.status(400).json({ error: "Invalid theme data" });
    }
  });

  // Update theme
  app.patch("/api/themes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate theme updates using partial schema
      const updateThemeSchema = insertThemeSchema.partial();
      const updates = updateThemeSchema.parse(req.body);
      
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const theme = await storage.updateTheme(id, updates, req.session.userId);
      
      if (!theme) {
        return res.status(404).json({ error: "Theme not found" });
      }
      
      // Invalidate cache after updating theme
      invalidateCache(req.session.userId);
      
      // Notify all connected clients about theme update
      if (globalIo) {
        globalIo.emit('themes:updated', { id, timestamp: Date.now() });
      }
      
      res.json(theme);
    } catch (error) {
      console.error("Error updating theme:", error);
      res.status(400).json({ error: "Invalid theme data" });
    }
  });

  // Set active theme
  app.patch("/api/themes/:id/activate", async (req, res) => {
    try {
      const { id } = req.params;
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const theme = await storage.setActiveTheme(id, req.session.userId);
      
      if (!theme) {
        return res.status(404).json({ error: "Theme not found" });
      }
      
      // Invalidate cache after activating theme
      invalidateCache(req.session.userId);
      
      // Notify all connected clients about active theme change
      if (globalIo) {
        globalIo.emit('themes:updated', { id, activated: true, timestamp: Date.now() });
      }
      
      res.json(theme);
    } catch (error) {
      console.error("Error activating theme:", error);
      res.status(500).json({ error: "Failed to activate theme" });
    }
  });

  // Delete theme
  app.delete("/api/themes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const deleted = await storage.deleteTheme(id, req.session.userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Theme not found or cannot delete active theme" });
      }
      
      // Invalidate cache immediately after deleting theme (destructive action)
      invalidateCache(req.session.userId, undefined, true);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting theme:", error);
      res.status(500).json({ error: "Failed to delete theme" });
    }
  });

  // Prayer Times API Routes
  app.get("/api/prayer-times", async (req, res) => {
    try {
      const { city = 'Kuala Lumpur', country = 'Malaysia', latitude, longitude } = req.query;
      
      let apiUrl = 'https://api.aladhan.com/v1/timings';
      let params: Record<string, string> = {
        method: '11' // Singapore method for Malaysia
      };

      // Use coordinates if provided, otherwise use city/country
      if (latitude && longitude) {
        params.latitude = latitude as string;
        params.longitude = longitude as string;
      } else {
        apiUrl = 'https://api.aladhan.com/v1/timingsByCity';
        params.city = city as string;
        params.country = country as string;
      }

      // Construct URL with params
      const searchParams = new URLSearchParams(params);
      const fullUrl = `${apiUrl}?${searchParams.toString()}`;

      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`Prayer times API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 200) {
        throw new Error('Failed to fetch prayer times');
      }

      // Extract prayer times and format them
      const timings = data.data.timings;
      const prayerTimes = [
        { name: "SUBUH", time: timings.Fajr, key: "fajr" },
        { name: "ZOHOR", time: timings.Dhuhr, key: "dhuhr" },
        { name: "ASAR", time: timings.Asr, key: "asr" },
        { name: "MAGHRIB", time: timings.Maghrib, key: "maghrib" },
        { name: "ISYAK", time: timings.Isha, key: "isha" }
      ];

      // Return prayer times with metadata - let client handle highlighting with browser timezone
      res.json({
        prayerTimes,
        date: data.data.date,
        location: { 
          city: city || 'Unknown', 
          country: country || 'Unknown' 
        },
        meta: {
          timezone: data.data.meta.timezone,
          method: data.data.meta.method.name
        }
      });

    } catch (error) {
      console.error("Error fetching prayer times:", error);
      res.status(500).json({ error: "Failed to fetch prayer times" });
    }
  });

  // Get user's location based on IP (fallback for geolocation)
  app.get("/api/location", async (req, res) => {
    try {
      // Simple IP-based location detection
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      
      // For development, default to Malaysia
      if (clientIP === '127.0.0.1' || clientIP === '::1' || !clientIP) {
        return res.json({
          city: 'Kuala Lumpur',
          country: 'Malaysia',
          latitude: 3.1390,
          longitude: 101.6869
        });
      }

      // In production, you could use a service like ipapi.co for IP geolocation
      // For now, default to Malaysia
      res.json({
        city: 'Kuala Lumpur',
        country: 'Malaysia', 
        latitude: 3.1390,
        longitude: 101.6869
      });

    } catch (error) {
      console.error("Error detecting location:", error);
      res.status(500).json({ error: "Failed to detect location" });
    }
  });

  // Get current weather based on location
  app.get("/api/weather", async (req, res) => {
    try {
      const { city = 'Kuala Lumpur', country = 'Malaysia', latitude, longitude } = req.query;
      
      let weatherUrl = 'https://api.openweathermap.org/data/2.5/weather?';
      let params: Record<string, string> = {
        units: 'metric', // Celsius
        lang: 'en'
      };

      // Use coordinates if provided, otherwise use city/country
      if (latitude && longitude) {
        params.lat = latitude as string;
        params.lon = longitude as string;
      } else {
        params.q = `${city},${country}`;
      }

      // Note: OpenWeatherMap requires API key for most endpoints
      // Using a free alternative: Open-Meteo API (no key required)
      if (latitude && longitude) {
        const lat = parseFloat(latitude as string);
        const lon = parseFloat(longitude as string);
        
        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        const response = await fetch(openMeteoUrl);
        
        if (!response.ok) {
          throw new Error(`Weather API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Map Open-Meteo weather codes to descriptions
        const getWeatherDescription = (code: number) => {
          const weatherCodes: Record<number, { description: string; icon: string }> = {
            0: { description: 'Clear sky', icon: '☀️' },
            1: { description: 'Mainly clear', icon: '🌤️' },
            2: { description: 'Partly cloudy', icon: '⛅' },
            3: { description: 'Overcast', icon: '☁️' },
            45: { description: 'Foggy', icon: '🌫️' },
            48: { description: 'Depositing rime fog', icon: '🌫️' },
            51: { description: 'Light drizzle', icon: '🌦️' },
            53: { description: 'Moderate drizzle', icon: '🌦️' },
            55: { description: 'Dense drizzle', icon: '🌧️' },
            61: { description: 'Slight rain', icon: '🌦️' },
            63: { description: 'Moderate rain', icon: '🌧️' },
            65: { description: 'Heavy rain', icon: '🌧️' },
            80: { description: 'Slight rain showers', icon: '🌦️' },
            81: { description: 'Moderate rain showers', icon: '🌧️' },
            82: { description: 'Violent rain showers', icon: '⛈️' },
            95: { description: 'Thunderstorm', icon: '⛈️' },
            96: { description: 'Thunderstorm with hail', icon: '⛈️' },
            99: { description: 'Thunderstorm with heavy hail', icon: '⛈️' }
          };
          return weatherCodes[code] || { description: 'Unknown', icon: '🌤️' };
        };

        const current = data.current;
        const weather = getWeatherDescription(current.weather_code);
        
        res.json({
          location: {
            city: city || 'Unknown',
            country: country || 'Unknown'
          },
          current: {
            temperature: Math.round(current.temperature_2m),
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            description: weather.description,
            icon: weather.icon
          },
          units: {
            temperature: '°C',
            windSpeed: 'km/h',
            humidity: '%'
          }
        });
        
      } else {
        // Fallback: Return default weather for KL if no coordinates
        res.json({
          location: {
            city: city || 'Kuala Lumpur',
            country: country || 'Malaysia'
          },
          current: {
            temperature: 30,
            humidity: 75,
            windSpeed: 10,
            description: 'Partly cloudy',
            icon: '⛅'
          },
          units: {
            temperature: '°C',
            windSpeed: 'km/h',
            humidity: '%'
          }
        });
      }

    } catch (error) {
      console.error("Error fetching weather:", error);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  });

  // Admin endpoint to get TV token for current user
  app.get("/api/users/me/tv-token", async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: "Session inactive" });
      }
      
      const tvToken = storage.generateTvToken(req.session.userId);
      
      res.json({
        tvToken: tvToken,
        tvUrl: `/tv?token=${tvToken}`,
        message: "TV Token for your clinic display"
      });
    } catch (error) {
      console.error("Error generating TV token:", error);
      res.status(500).json({ error: "Failed to generate TV token" });
    }
  });

  // ===== TV DISPLAY TOKEN ROUTES =====
  // These routes serve authenticated TV displays using clinic tokens
  
  // TV Token resolution endpoint - resolve token to userId
  app.get("/api/tv/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByTvToken(token);
      if (!user) {
        return res.status(404).json({ error: "Invalid TV token or clinic not found" });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ error: "Clinic account not active" });
      }
      
      // Return basic clinic info for TV display
      res.json({
        clinicId: user.id,
        clinicName: user.username,
        isActive: user.isActive,
        token: token
      });
    } catch (error) {
      console.error("Error resolving TV token:", error);
      res.status(500).json({ error: "Failed to resolve TV token" });
    }
  });
  
  // TV Settings endpoint - get settings for specific clinic token
  // ✅ OPTIMIZED: Uses getTvSettings() to avoid fetching 200KB clinicLogo from database
  app.get("/api/tv/:token/settings", async (req, res) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByTvToken(token);
      if (!user || !user.isActive) {
        return res.status(404).json({ error: "Invalid TV token" });
      }
      
      // ✅ CRITICAL FIX: Fetch only TV-needed keys from database (excludes clinicLogo)
      const tvSettingsKeys = Array.from(TV_SETTINGS_KEYS);
      const settings = await storage.getTvSettings(user.id, tvSettingsKeys);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching TV settings:", error);
      res.status(500).json({ error: "Failed to get TV settings" });
    }
  });

  // ✅ TV Logo endpoint - dedicated logo fetch with HTTP caching for unauthenticated TV displays
  app.get("/api/tv/:token/logo", async (req, res) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByTvToken(token);
      if (!user || !user.isActive) {
        return res.status(404).json({ error: "Invalid TV token" });
      }
      
      const logoSetting = await storage.getSetting('clinicLogo', user.id);
      const logo = logoSetting?.value || '';
      
      // Set HTTP cache headers - cache for 1 hour
      res.set('Cache-Control', 'public, max-age=3600');
      res.json({ logo });
    } catch (error) {
      console.error("Error fetching TV logo:", error);
      res.status(500).json({ error: "Failed to get TV logo" });
    }
  });
  
  // TV Active Theme endpoint
  app.get("/api/tv/:token/themes/active", async (req, res) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByTvToken(token);
      if (!user || !user.isActive) {
        return res.status(404).json({ error: "Invalid TV token" });
      }
      
      const activeTheme = await storage.getActiveTheme(user.id);
      res.json(activeTheme);
    } catch (error) {
      console.error("Error fetching TV active theme:", error);
      res.status(500).json({ error: "Failed to get active TV theme" });
    }
  });
  
  // TV Active Text Groups endpoint
  app.get("/api/tv/:token/text-groups/active", async (req, res) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByTvToken(token);
      if (!user || !user.isActive) {
        return res.status(404).json({ error: "Invalid TV token" });
      }
      
      const activeTextGroups = await storage.getActiveTextGroups(user.id);
      res.json(activeTextGroups);
    } catch (error) {
      console.error("Error fetching TV active text groups:", error);
      res.status(500).json({ error: "Failed to get active TV text groups" });
    }
  });
  
  // TV Active Media endpoint
  app.get("/api/tv/:token/media/active", async (req, res) => {
    try {
      const { token } = req.params;
      
      const user = await storage.getUserByTvToken(token);
      if (!user || !user.isActive) {
        return res.status(404).json({ error: "Invalid TV token" });
      }
      
      const activeMedia = await storage.getActiveMedia(user.id);
      res.json(activeMedia);
    } catch (error) {
      console.error("Error fetching TV active media:", error);
      res.status(500).json({ error: "Failed to get active TV media" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
