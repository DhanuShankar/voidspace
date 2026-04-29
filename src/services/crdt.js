import crypto from "crypto";

/**
 * CRDT (Conflict-free Replicated Data Type) Service
 * Provides operational transformation for real-time collaboration
 */
class CRDTService {
  constructor() {
    this.documents = new Map();
    this.listeners = new Map();
  }

  /**
   * Initialize a new document
   */
  initializeDocument(docId, userId, userName) {
    if (!this.documents.has(docId)) {
      this.documents.set(docId, {
        docId,
        content: "",
        version: 0,
        createdAt: new Date().toISOString(),
        participants: new Map(),
        operations: [],
      });

      this.listeners.set(docId, []);
    }

    this.addParticipant(docId, userId, null, userName);
  }

  /**
   * Add participant to document
   */
  addParticipant(docId, userId, socketId, userName) {
    const doc = this.documents.get(docId);
    if (doc) {
      doc.participants.set(userId, {
        userId,
        socketId,
        userName,
        cursor: { line: 0, column: 0 },
        joinedAt: Date.now(),
      });
    }
  }

  /**
   * Remove participant from document
   */
  removeParticipant(docId, socketId) {
    const doc = this.documents.get(docId);
    if (doc) {
      for (const [userId, participant] of doc.participants.entries()) {
        if (participant.socketId === socketId) {
          doc.participants.delete(userId);
          break;
        }
      }
    }
  }

  /**
   * Clean up socket references
   */
  cleanupSocket(socketId) {
    for (const [docId, doc] of this.documents.entries()) {
      let removed = false;
      for (const [userId, participant] of doc.participants.entries()) {
        if (participant.socketId === socketId) {
          doc.participants.delete(userId);
          removed = true;
        }
      }
      // If document is empty, can clean it up
      if (removed && doc.participants.size === 0) {
        this.documents.delete(docId);
        this.listeners.delete(docId);
      }
    }
  }

  /**
   * Insert text operation
   */
  insertText(position, text, userId) {
    const docId = "default"; // Simplified for now

    if (!this.documents.has(docId)) {
      this.initializeDocument(docId, userId, "User");
    }

    const doc = this.documents.get(docId);
    const operationId = crypto.randomUUID();
    const version = ++doc.version;

    const operation = {
      id: operationId,
      type: "insert",
      position,
      text,
      userId,
      version,
      timestamp: Date.now(),
    };

    doc.operations.push(operation);

    // Apply to content
    const before = doc.content.substring(0, position);
    const after = doc.content.substring(position);
    doc.content = before + text + after;

    // Broadcast to listeners
    this.emit(docId, {
      type: "insert",
      position,
      text,
      userId,
      version,
    });

    return operation;
  }

  /**
   * Delete text operation
   */
  deleteText(position, length, userId) {
    const docId = "default";

    if (!this.documents.has(docId)) {
      this.initializeDocument(docId, userId, "User");
    }

    const doc = this.documents.get(docId);
    const operationId = crypto.randomUUID();
    const version = ++doc.version;

    const deletedText = doc.content.substring(position, position + length);

    const before = doc.content.substring(0, position);
    const after = doc.content.substring(position + length);
    doc.content = before + after;

    const operation = {
      id: operationId,
      type: "delete",
      position,
      length,
      deletedText,
      userId,
      version,
      timestamp: Date.now(),
    };

    doc.operations.push(operation);

    this.emit(docId, {
      type: "delete",
      position,
      length,
      userId,
      version,
    });

    return operation;
  }

  /**
   * Update cursor position
   */
  updateCursor(docId, userId, position) {
    const doc = this.documents.get(docId);
    if (doc) {
      const participant = doc.participants.get(userId);
      if (participant) {
        participant.cursor = position;
      }
    }
  }

  /**
   * Get document state
   */
  getDocumentState(docId = "default") {
    const doc = this.documents.get(docId);
    if (!doc) {
      return { content: "", version: 0, participants: [] };
    }

    return {
      content: doc.content,
      version: doc.version,
      participants: Array.from(doc.participants.values()).map((p) => ({
        userId: p.userId,
        userName: p.userName,
        cursor: p.cursor,
      })),
    };
  }

  /**
   * Get participants in document
   */
  getParticipants(docId) {
    const doc = this.documents.get(docId);
    if (!doc) return [];

    return Array.from(doc.participants.values()).map((p) => ({
      userId: p.userId,
      userName: p.userName,
      cursor: p.cursor,
    }));
  }

  /**
   * Register broadcast listener
   */
  onBroadcast(callback) {
    // In real implementation, this would register per-document listeners
    // Simplified for compatibility with existing code
  }

  /**
   * Emit event to all listeners of a document
   */
  emit(docId, event) {
    const listeners = this.listeners.get(docId);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }
  }
}

export default new CRDTService();
