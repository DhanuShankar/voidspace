import express from "express";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import config from "./config/index.js";
import routes from "./routes/index.js";
import {
  corsMiddleware,
  securityMiddleware,
  requestIdMiddleware,
} from "./middleware/security.js";
import { generalLimiter, authLimiter, uploadLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { initWebSocket } from "./ws/server.js";
import colabSessionManager from "./services/colabSessionManager.js";
import crdt from "./services/crdt.js";
import gatewayManager from "./services/gatewayManager.js";
import driveSync from "./services/googleDriveSync.js";
import headlessBrowser from "./services/headlessBrowser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create Express application
 */
export function createApp() {
  const app = express();

  // ============ Core Middleware ============
  app.use(corsMiddleware);
  app.use(securityMiddleware);
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // ============ Rate Limiting ============
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/signup", authLimiter);
  app.use("/api/files/upload", uploadLimiter);
  app.use("/api", generalLimiter);

  // ============ Request Logging (Dev) ============
  if (config.nodeEnv === "development") {
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  // ============ Health Checks ============
  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      service: config.api.title,
      version: config.api.version,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    });
  });

  app.get("/ready", (req, res) => {
    res.json({
      status: "ready",
      checks: { config: "ok", services: "ok" },
      timestamp: new Date().toISOString(),
    });
  });

  // ============ API Routes ============
  app.use("/api", routes);

  // ============ Static Frontend ============
  if (config.nodeEnv !== "production") {
    (async () => {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
          root: path.resolve(__dirname, "../.."),
        });
        app.use(vite.middlewares);
        console.log("[Vite] Dev server attached");
      } catch (err) {
        console.error("[Vite] Failed:", err);
      }
    })();
  } else {
    const distPath = path.resolve(__dirname, "../../dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  // ============ Error Handling ============
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Start server
 */
export async function startServer() {
  const app = createApp();
  const httpServer = createHttpServer(app);
  const io = initWebSocket(httpServer);

  // Initialize services
  try {
    await colabSessionManager.initialize();
    await gatewayManager.initialize();
    await crdt.initialize();
    console.log("[Services] Initialized");
  } catch (err) {
    console.error("[Services] Init error:", err);
  }

  const PORT = config.port;

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║   🚀 VoidSpace API Server Started 🚀           ║
╠═══════════════════════════════════════════════╣
║ 🌐 http://localhost:${PORT}${" ".repeat(28 - String(PORT).length)}║
║                                               ║
║ 📊 Features:                                 ║
║   ✓ RESTful API Design                       ║
║   ✓ JWT Authentication                       ║
║   ✓ WebSocket Real-time                      ║
║   ✓ Rate Limiting & Security                 ║
║   ✓ File Operations                          ║
║   ✓ Workspace Management                     ║
║   ✓ Session Management                       ║
║   ✓ Gateway Proxy                            ║
║   ✓ AI Code Completion                       ║
║   ✓ API Docs (Swagger)                       ║
╚═══════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[Shutdown] Graceful shutdown...");
    await colabSessionManager.shutdown();
    httpServer.close(() => {
      console.log("[Shutdown] Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return { app, httpServer, io };
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch((err) => {
    console.error("[Fatal] Failed to start:", err);
    process.exit(1);
  });
}