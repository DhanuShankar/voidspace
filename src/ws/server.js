import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import config from "../config/index.js";

let io = null;

/**
 * Initialize WebSocket server
 */
export const initWebSocket = (httpServer) => {
  io = new SocketIOServer(httpServer, config.websocket);

  // Connection timeout handling
  io.engine.on("connection", (socket) => {
    socket.on("error", (err) => {
      console.error("WebSocket error:", err);
    });

    // Handle ping/pong for connection health
    socket.on("ping", () => {
      socket.emit("pong");
    });
  });

  // Connection event
  io.on("connection", (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Join a room (e.g., workspace, document)
    socket.on("join", (data) => {
      const { room, userId, userName } = data;

      if (room) {
        socket.join(room);
        socket.room = room;
        socket.userId = userId;
        socket.userName = userName;

        console.log(`[WS] User ${userName || userId} joined room: ${room}`);

        // Notify others in room
        socket.to(room).emit("user-joined", {
          userId,
          userName,
          socketId: socket.id,
        });
      }
    });

    // Leave a room
    socket.on("leave", (room) => {
      if (socket.room === room) {
        socket.leave(room);
        socket.to(room).emit("user-left", {
          userId: socket.userId,
          socketId: socket.id,
        });
        console.log(`[WS] User left room: ${room}`);
      }
    });

    // File change broadcast
    socket.on("file-change", (data) => {
      const { workspaceId, fileId, changes, userId } = data;
      if (workspaceId) {
        socket.to(workspaceId).emit("remote-change", {
          fileId,
          changes,
          userId,
        });
      }
    });

    // Cursor update broadcast
    socket.on("cursor-update", (data) => {
      const { workspaceId, position, userId } = data;
      if (workspaceId) {
        socket.to(workspaceId).emit("user-cursor", {
          position,
          userId,
          socketId: socket.id,
        });
      }
    });

    // Terminal output
    socket.on("terminal-output", (data) => {
      const { workspaceId, output, type } = data;
      if (workspaceId) {
        socket.to(workspaceId).emit("terminal-stream", {
          output,
          type,
          userId: socket.userId,
        });
      }
    });

    // AI completion request
    socket.on("ai-completion-request", (data) => {
      // Forward to AI service, emit response to all in workspace
      console.log("[WS] AI completion request received");
    });

    // Disconnect
    socket.on("disconnect", (reason) => {
      console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);

      // Notify room members
      if (socket.room) {
        socket.to(socket.room).emit("user-disconnected", {
          userId: socket.userId,
          socketId: socket.id,
        });
      }
    });

    // Error handling
    socket.on("error", (err) => {
      console.error(`[WS] Socket error for ${socket.id}:`, err);
    });
  });

  // Periodic health check
  setInterval(() => {
    io.sockets.sockets.forEach((socket) => {
      if (socket.connected) {
        socket.emit("heartbeat");
      }
    });
  }, config.websocket.heartbeatInterval);

  return io;
};

/**
 * Get WebSocket server instance
 */
export const getIO = () => io;

/**
 * Emit to specific room
 */
export const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

/**
 * Broadcast to all connected clients
 */
export const broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

/**
 * Emit to specific socket
 */
export const emitToSocket = (socketId, event, data) => {
  if (io) {
    io.to(socketId).emit(event, data);
  }
};
