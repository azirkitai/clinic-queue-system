import { Server, Socket } from "socket.io";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { storage } from "./storage";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  clinicRoom?: string;
}

/**
 * Setup WebSocket server with multi-tenant isolation
 * Each clinic gets isolated rooms based on userId to prevent cross-tenant communication
 */
export function setupWebSocket(io: Server) {
  // Middleware to authenticate WebSocket connections using session
  io.use((socket: AuthenticatedSocket, next) => {
    const req = socket.request as any;
    
    // Parse session from socket request
    const PgSession = connectPgSimple(session);
    const sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions',
      createTableIfMissing: true,
    });
    
    // Get session ID from cookie
    const sessionParser = session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'clinic-management-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    });
    
    sessionParser(req, {} as any, () => {
      if (req.session && req.session.userId) {
        // Authenticated connection - assign userId and clinic room
        socket.userId = req.session.userId;
        socket.clinicRoom = `clinic:${req.session.userId}`;
        // console.log removed (emoji)
        next();
      } else {
        // Unauthenticated connection - could be TV display
        // For now, we'll allow but without joining clinic rooms
        // console.log removed (emoji)
        next();
      }
    });
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    // console.log removed (emoji)

    if (socket.userId && socket.clinicRoom) {
      // Join clinic-specific room for tenant isolation
      socket.join(socket.clinicRoom);
      // console.log removed (emoji)
      
      // Emit welcome message to confirm room join
      socket.emit("clinic:joined", {
        clinicId: socket.userId,
        room: socket.clinicRoom,
        message: "Connected to clinic real-time updates"
      });
    }

    // Handle real-time patient call events
    socket.on("patient:call", (data) => {
      if (!socket.userId || !socket.clinicRoom) {
        socket.emit("error", { message: "Authentication required for patient calls" });
        return;
      }
      
      console.log(`[WEBSOCKET] Patient call from clinic ${socket.userId}:`, data);
      
      // Broadcast to all clients in the same clinic room
      io.to(socket.clinicRoom).emit("patient:called", {
        ...data,
        timestamp: new Date(),
        clinicId: socket.userId
      });
    });

    // Handle patient status updates (completed, etc.)
    socket.on("patient:update", (data) => {
      if (!socket.userId || !socket.clinicRoom) {
        socket.emit("error", { message: "Authentication required for patient updates" });
        return;
      }
      
      console.log(`[WEBSOCKET] Patient update from clinic ${socket.userId}:`, data);
      
      // Broadcast to all clients in the same clinic room
      io.to(socket.clinicRoom).emit("patient:updated", {
        ...data,
        timestamp: new Date(),
        clinicId: socket.userId
      });
    });

    // Handle queue updates
    socket.on("queue:update", (data) => {
      if (!socket.userId || !socket.clinicRoom) {
        socket.emit("error", { message: "Authentication required for queue updates" });
        return;
      }
      
      console.log(`[WEBSOCKET] Queue update from clinic ${socket.userId}:`, data);
      
      // Broadcast to all clients in the same clinic room
      io.to(socket.clinicRoom).emit("queue:updated", {
        ...data,
        timestamp: new Date(),
        clinicId: socket.userId
      });
    });

    // Handle TV display connections (unauthenticated but token-based)
    socket.on("tv:connect", (data) => {
      const { token } = data;
      
      if (!token) {
        socket.emit("error", { message: "TV token required" });
        return;
      }
      
      // TODO: Validate TV token and join appropriate clinic room
      // This will be implemented when TV token validation is needed
      // console.log removed (emoji)
      socket.emit("tv:connected", { message: "TV display connected" });
    });

    // Handle QR authentication flow (server-authoritative)
    socket.on("qr:join", async (data) => {
      const { qrId } = data;
      
      if (!qrId) {
        socket.emit("error", { message: "QR ID diperlukan" });
        return;
      }
      
      // Validate QR session exists and is not expired (server-authoritative)
      try {
        const qrSession = await storage.getQrSession(qrId);
        if (!qrSession) {
          socket.emit("qr:expired", { 
            qrId, 
            message: "Sesi QR tidak dijumpai atau sudah tamat tempoh" 
          });
          return;
        }
        
        if (qrSession.expiresAt < new Date()) {
          socket.emit("qr:expired", { 
            qrId, 
            message: "Sesi QR sudah tamat tempoh" 
          });
          return;
        }
        
        const qrRoom = `qr:${qrId}`;
        socket.join(qrRoom);
        // console.log removed (emoji)
        
        socket.emit("qr:joined", { 
          qrId, 
          message: "Menunggu pengesahan QR",
          room: qrRoom,
          expiresAt: qrSession.expiresAt.toISOString()
        });
      } catch (error) {
        console.error("Error validating QR session:", error);
        socket.emit("error", { message: "Gagal mengesahkan sesi QR" });
      }
    });

    // REMOVED: Client-controlled qr:authorized and qr:finalized events
    // These are now server-authoritative and emitted from API endpoints

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      // console.log removed (emoji)
      
      if (socket.clinicRoom) {
        // console.log removed (emoji)
      }
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`❌ WebSocket error for ${socket.id}:`, error);
    });
  });

  console.log("[WEBSOCKET] WebSocket server initialized with multi-tenant room isolation");
}

// Helper function to broadcast to specific clinic
export function broadcastToClinic(io: Server, userId: string, event: string, data: any) {
  const clinicRoom = `clinic:${userId}`;
  console.log(`[WEBSOCKET] Broadcasting to clinic ${userId} (room: ${clinicRoom}):`, event);
  
  io.to(clinicRoom).emit(event, {
    ...data,
    timestamp: new Date(),
    clinicId: userId
  });
}