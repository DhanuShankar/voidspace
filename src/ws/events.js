// WebSocket Event Types
export const EVENTS = {
  // Client -> Server
  JOIN: "join",
  LEAVE: "leave",
  FILE_CHANGE: "file-change",
  CURSOR_UPDATE: "cursor-update",
  TERMINAL_OUTPUT: "terminal-output",
  AI_COMPLETION_REQUEST: "ai-completion-request",
  PING: "ping",

  // Server -> Client
  DOCUMENT_STATE: "document-state",
  REMOTE_CHANGE: "remote-change",
  USER_CURSOR: "user-cursor",
  USER_JOINED: "user-joined",
  USER_LEFT: "user-left",
  USER_DISCONNECTED: "user-disconnected",
  TERMINAL_STREAM: "terminal-stream",
  AI_COMPLETION_RESPONSE: "ai-completion-response",
  PONG: "pong",
  HEARTBEAT: "heartbeat",
  ERROR: "error",
};

/**
 * Document collaboration event handler
 */
export const handleDocumentEvents = (io, crdtService) => {
  io.on("connection", (socket) => {
    console.log(`[Document] Socket connected: ${socket.id}`);

    socket.on("join-document", ({ docId, userId, userName }) => {
      const room = `doc:${docId}`;
      socket.join(room);

      // Initialize or retrieve CRDT document state
      const state = crdtService.getDocumentState(docId);

      socket.emit(EVENTS.DOCUMENT_STATE, {
        docId,
        state,
        participants: crdtService.getParticipants(docId),
      });

      socket.to(room).emit(EVENTS.USER_JOINED, {
        userId,
        userName,
        socketId: socket.id,
      });

      crdtService.addParticipant(docId, userId, socket.id, userName);

      console.log(`[Document] ${userName} joined document ${docId}`);
    });

    socket.on("insert-text", ({ docId, position, text, userId }) => {
      const change = crdtService.applyInsert(docId, position, text, userId);

      if (change) {
        socket.to(`doc:${docId}`).emit("remote-insert", change);
      }
    });

    socket.on("delete-text", ({ docId, position, length, userId }) => {
      const change = crdtService.applyDelete(docId, position, length, userId);

      if (change) {
        socket.to(`doc:${docId}`).emit("remote-delete", change);
      }
    });

    socket.on("cursor-update", ({ docId, position, userId }) => {
      crdtService.updateCursor(docId, userId, position);

      socket.to(`doc:${docId}`).emit("user-cursor", {
        userId,
        position,
        socketId: socket.id,
      });
    });

    socket.on("leave-document", ({ docId }) => {
      const room = `doc:${docId}`;
      socket.leave(room);
      crdtService.removeParticipant(docId, socket.id);
      socket.to(room).emit("user-left", { socketId: socket.id });
    });

    socket.on("disconnect", () => {
      // Clean up all document participants
      crdtService.cleanupSocket(socket.id);
      console.log(`[Document] Socket disconnected: ${socket.id}`);
    });
  });
};

/**
 * Terminal streaming event handler
 */
export const handleTerminalEvents = (io) => {
  return {
    onOutput: (workspaceId, output, type = "stdout") => {
      io.to(`workspace:${workspaceId}`).emit(EVENTS.TERMINAL_STREAM, {
        output,
        type,
        timestamp: Date.now(),
      });
    },

    onCommand: (workspaceId, command, userId) => {
      io.to(`workspace:${workspaceId}`).emit("command-executed", {
        command,
        userId,
        timestamp: Date.now(),
      });
    },
  };
};

/**
 * AI streaming event handler
 */
export const handleAIEvents = (io) => {
  return {
    onStreamStart: (socketId, requestId) => {
      emitToSocket(socketId, "ai-completion-start", { requestId });
    },

    onStreamChunk: (socketId, chunk, requestId) => {
      emitToSocket(socketId, "ai-completion-chunk", { chunk, requestId });
    },

    onStreamComplete: (socketId, result, requestId) => {
      emitToSocket(socketId, "ai-completion-complete", { result, requestId });
    },

    onStreamError: (socketId, error, requestId) => {
      emitToSocket(socketId, "ai-completion-error", { error, requestId });
    },
  };
};
