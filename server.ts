import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import Anthropic from "@anthropic-ai/sdk";
import { colabSessionManager, ColabSessionConfig } from "./src/services/colabSessionManager";
import { colabBridge } from "./src/services/colabKernelBridge";
import { GoogleDriveSyncManager } from "./src/services/googleDriveSync";
import { HeadlessBrowserManager } from "./src/services/headlessBrowser";
import { generateAuthUrl, getTokenFromCode, setCredentials } from "./src/services/googleAuth";
import { gatewayManager, GatewayExecutionRequest } from "./src/services/gatewayManager";
import { getCollaborationManager } from "./src/collab";
import {
  createUser,
  authenticateUser,
  getUserById,
  createOrLinkGoogleUser,
  generateToken,
  verifyToken,
  getUserStats,
  updateColabQuota,
  upgradeUserPlan,
} from "./src/services/authService";
import * as fs from "fs";
import multer from "multer";
import * as uuid from "uuid";
import dotenv from "dotenv";

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

// Middleware to verify auth token
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.userId = decoded.userId;
  next();
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Initialize collaboration system
  const collabManager = getCollaborationManager({
    enableOfflineMode: true,
    enableVersioning: true,
    maxUndoDepth: 100,
    autoSaveInterval: 30000,
  });

  // Initialize WebSocket with enhanced features
  const wsServer = collabManager.initialize(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 25000,
    pingTimeout: 5000,
    maxHttpBufferSize: 1e6,
  });

  const io = wsServer.getIO();

  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ==============================================================================
  // AUTHENTICATION ROUTES
  // ==============================================================================

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await createUser(email, password, name);

      if (!result) {
        return res.status(400).json({ error: "Failed to create user" });
      }

      res.json({
        success: true,
        user: result.user,
        token: result.token,
        message: "Account created successfully",
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
      }

      const result = await authenticateUser(email, password);

      if (!result) {
        return res.status(401).json({ error: "Authentication failed" });
      }

      res.json({
        success: true,
        user: result.user,
        token: result.token,
        message: "Logged in successfully",
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  app.get("/api/auth/me", authMiddleware, (req: any, res) => {
    try {
      const user = getUserById(req.userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/stats", authMiddleware, (req: any, res) => {
    try {
      const stats = getUserStats(req.userId);

      if (!stats) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/upgrade-plan", authMiddleware, async (req: any, res) => {
    try {
      const { plan } = req.body;

      if (!["pro", "enterprise"].includes(plan)) {
        return res.status(400).json({ error: "Invalid plan" });
      }

      const user = upgradeUserPlan(req.userId, plan);

      res.json({
        success: true,
        user,
        message: `Upgraded to ${plan} plan`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      // In production, save to Mailchimp or similar
      console.log(`✓ Newsletter subscription: ${email}`);

      res.json({ success: true, message: "Subscribed to newsletter" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // GOOGLE OAUTH
  // ==============================================================================

  app.get("/api/auth/google/url", (req, res) => {
    try {
      const authUrl = generateAuthUrl();
      res.json({ url: authUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, profile } = req.body;

      if (!profile || !profile.email) {
        return res.status(400).json({ error: "Invalid profile" });
      }

      const result = await createOrLinkGoogleUser(profile.id, profile.email, profile.name);

      res.json({
        success: true,
        user: result.user,
        token: result.token,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // COLAB SESSION MANAGEMENT
  // ==============================================================================

  app.post("/api/colab/session/start", authMiddleware, async (req: any, res) => {
    try {
      const { accessToken, workspaceName, enableGPU } = req.body;
      const user = getUserById(req.userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const config: ColabSessionConfig = {
        userId: req.userId,
        accessToken,
        workspaceName: workspaceName || `VOID - ${user.name}`,
        autoShutdownMinutes: 720,
        enableGPU: enableGPU || true,
      };

      const session = await colabSessionManager.start(config);

      res.json({
        success: true,
        session,
        message: "Colab session started with 4-12 hour runtime",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/colab/session/info", authMiddleware, (req, res) => {
    try {
      const info = colabSessionManager.getSessionInfo();
      res.json(info);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/colab/session/metrics", authMiddleware, async (req, res) => {
    try {
      const metrics = await colabSessionManager.getMetrics();
      const remaining = colabSessionManager.getRemainingTimeFormatted();

      res.json({
        ...metrics,
        remainingTimeFormatted: remaining,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/colab/session/shutdown", authMiddleware, async (req, res) => {
    try {
      await colabSessionManager.shutdown();
      res.json({ success: true, message: "Colab session shut down" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/colab/session/restart", authMiddleware, async (req, res) => {
    try {
      await colabSessionManager.restart();
      res.json({ success: true, message: "Colab kernel restarted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // CODE EXECUTION ROUTES
  // ==============================================================================

  app.post("/api/execute/code", authMiddleware, async (req: any, res) => {
    try {
      const { code, language, gateway } = req.body;

      let activeGateway = gateway || "colab";
      await gatewayManager.setActiveGateway(activeGateway);

      const request: GatewayExecutionRequest = {
        code,
        language,
        timeout: 30000,
      };

      const result = await gatewayManager.execute(request);

      if (activeGateway === "colab") {
        try {
          await colabSessionManager.executeCode(code, language);
          updateColabQuota(req.userId, 0.08); // ~5 min per execution
        } catch {}
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        output: "",
        stderr: error.message,
        executionTime: 0,
      });
    }
  });

  app.post("/api/execute/colab", authMiddleware, async (req: any, res) => {
    try {
      const { code } = req.body;

      const result = await colabSessionManager.executeCode(code, "python");
      updateColabQuota(req.userId, 0.08);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // GATEWAY MANAGEMENT
  // ==============================================================================

  app.get("/api/gateways/list", authMiddleware, (req, res) => {
    try {
      const gateways = gatewayManager.listGateways();
      res.json(gateways);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gateways/activate", authMiddleware, async (req, res) => {
    try {
      const { name } = req.body;
      const success = await gatewayManager.setActiveGateway(name);

      res.json({ success, activeGateway: name });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/gateways/active", authMiddleware, (req, res) => {
    try {
      const activeGateway = gatewayManager.getActiveGateway();
      res.json({
        active: activeGateway ? activeGateway.getName() : null,
        type: activeGateway ? activeGateway.getType() : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/gateways/health", authMiddleware, async (req, res) => {
    try {
      const health = await gatewayManager.healthCheckAll();
      res.json(health);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // GOOGLE DRIVE SYNC
  // ==============================================================================

  const driveSync = new GoogleDriveSyncManager();

  app.post("/api/drive/init", authMiddleware, async (req: any, res) => {
    try {
      const { accessToken } = req.body;
      setCredentials({ access_token: accessToken });

      const rootFolderId = await driveSync.initializeRootFolder();

      res.json({
        success: true,
        rootFolderId,
        message: "Google Drive initialized",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/drive/save-session", authMiddleware, async (req: any, res) => {
    try {
      const { sessionData } = req.body;

      const sessionId = await driveSync.saveSession(sessionData);

      res.json({
        success: true,
        sessionId,
        message: "Session saved to Google Drive",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/drive/sessions", authMiddleware, async (req, res) => {
    try {
      const sessions = await driveSync.listSessions();
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // COLLABORATION (CRDT + WebSocket)
  // ==============================================================================
  // WebSocket server is initialized above with enhanced features
  // All real-time events are handled by the WebSocketServer class

  // REST API endpoints for collaboration

  app.get("/api/collab/rooms", authMiddleware, (req, res) => {
    try {
      const rooms = collabManager.getAllRooms();
      res.json(rooms);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collab/room/create", authMiddleware, async (req, res) => {
    try {
      const { docId, name, isPublic, maxUsers } = req.body;
      const userId = req.userId;

      // Create document first if not exists
      if (!collabManager.getDocument(docId)) {
        await collabManager.createDocument(docId, '');
      }

      const room = await collabManager.createRoom({
        documentId: docId,
        name,
        isPublic,
        maxUsers,
      });

      res.json({ success: true, roomId: room.id, room });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/collab/room/:roomId", authMiddleware, (req, res) => {
    try {
      const room = collabManager.getRoom(req.params.roomId);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(room);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collab/room/:roomId/join", authMiddleware, (req, res) => {
    try {
      const { roomId } = req.params;
      const user = getUserById(req.userId);

      const success = collabManager.joinRoom(roomId, user.id, user.name);

      res.json({ success, roomId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collab/room/:roomId/leave", authMiddleware, (req, res) => {
    try {
      const { roomId } = req.params;
      collabManager.leaveRoom(roomId, req.userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/collab/document/:docId", authMiddleware, (req, res) => {
    try {
      const doc = collabManager.getDocument(req.params.docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collab/document/:docId/operation", authMiddleware, (req, res) => {
    try {
      const { docId } = req.params;
      const operation = req.body;

      const result = collabManager.applyOperation(docId, operation);

      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/collab/stats", authMiddleware, (req, res) => {
    try {
      const stats = collabManager.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collab/snapshot/:docId", authMiddleware, (req, res) => {
    try {
      const snapshot = collabManager.createSnapshot(req.params.docId);
      res.json({ success: true, snapshot });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collab/invite/:roomId/generate", authMiddleware, (req, res) => {
    try {
      const { roomId } = req.params;
      const token = collabManager.generateInviteToken(roomId, req.userId);
      res.json({ success: true, token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/collab/invite/use", authMiddleware, (req, res) => {
    try {
      const { token } = req.body;
      const user = getUserById(req.userId);
      const success = collabManager.useInviteToken(token, user.id, user.name);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // AI CODE COMPLETION
  // ==============================================================================

  app.post("/api/ai/chat", authMiddleware, async (req, res) => {
    try {
      const { messages, system, model = "claude-3-5-sonnet-20240620" } = req.body;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "ANTHROPIC_API_KEY not configured",
        });
      }

      const anthropic = new Anthropic({ apiKey });

      const stream = await anthropic.messages.stream({
        model,
        max_tokens: 4096,
        system: system || "You are a helpful programming assistant.",
        messages: messages || [],
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/complete", authMiddleware, async (req, res) => {
    try {
      const { code, language, context } = req.body;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "ANTHROPIC_API_KEY not configured",
        });
      }

      const anthropic = new Anthropic({ apiKey });

      const prompt = `Complete this ${language} code based on context:\n${context}\n\nCode to complete:\n${code}`;

      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const completion = (message.content[0] as any).text;
      res.json({ completion });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // FILE UPLOAD/DOWNLOAD
  // ==============================================================================

  app.post("/api/files/upload", authMiddleware, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const fileName = req.file.originalname;
      const fileContent = req.file.buffer.toString();

      const fileId = uuid.v4();

      res.json({
        success: true,
        fileId,
        fileName,
        size: req.file.size,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==============================================================================
  // VITE MIDDLEWARE FOR DEVELOPMENT
  // ==============================================================================

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🚀 VOID Cloud IDE Server Started 🚀     ║
╠════════════════════════════════════════════╣
║ 🌐 http://localhost:${PORT}                    ║
║                                            ║
║ 📊 Features:                              ║
║   ✓ Google Colab T4 GPU (4-12 hrs)       ║
║   ✓ Multi-Gateway System                  ║
║   ✓ Real-Time Collaboration (CRDT)       ║
║   ✓ Google Drive Sync                     ║
║   ✓ AI Code Completion                    ║
║   ✓ WebSocket Live Updates                ║
║   ✓ User Authentication & Plans           ║
║   ✓ Marketing Landing Page                ║
╚════════════════════════════════════════════╝
    `);
  });
}

startServer();
