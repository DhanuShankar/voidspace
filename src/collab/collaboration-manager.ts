/**
 * Collaboration Manager
 * Main entry point for real-time collaboration features
 */

import { CRDTDocument } from '../crdt/crdt-document';
import { WebSocketServer } from '../ws/socket';
import { RoomManager } from './room-manager';
import { PresenceManager } from './presence-manager';
import { EventBus } from './event-bus';
import { OperationalTransformer } from '../crdt/operational-transformer';
import * as Automerge from 'automerge';
import {
  DocumentState,
  Operation,
  UserPresence,
  Room,
  RoomConfig,
  CollabEvent,
  DocumentSnapshot,
  OfflineChange,
} from '../types/collab.types';

export interface CollaborationConfig {
  enableOfflineMode?: boolean;
  enableVersioning?: boolean;
  enableCompression?: boolean;
  maxUndoDepth?: number;
  autoSaveInterval?: number;
}

export interface BatchOperation {
  operations: Operation[];
  baseVersion: number;
  expectedVersion: number;
}

export class CollaborationManager {
  private documents: Map<string, CRDTDocument> = new Map();
  private wsServer?: WebSocketServer;
  private roomManager: RoomManager;
  private presenceManager: PresenceManager;
  private eventBus: EventBus;
  private otEngine: OperationalTransformer;
  private offlineQueue: Map<string, OfflineChange[]> = new Map();
  private config: CollaborationConfig;

  constructor(config: CollaborationConfig = {}) {
    this.roomManager = new RoomManager();
    this.presenceManager = new PresenceManager();
    this.eventBus = new EventBus();
    this.otEngine = new OperationalTransformer();
    this.config = {
      enableOfflineMode: true,
      enableVersioning: true,
      enableCompression: true,
      maxUndoDepth: 100,
      autoSaveInterval: 30000,
      ...config,
    };

    this.setupInternalEventHandlers();
  }

  /**
   * Initialize server-side collaboration
   */
  initialize(httpServer: any, wsConfig?: any): WebSocketServer {
    this.wsServer = new WebSocketServer(httpServer, wsConfig);
    this.eventBus.registerWebSocketServer(this.wsServer);
    return this.wsServer;
  }

  /**
   * Setup internal event handlers
   */
  private setupInternalEventHandlers(): void {
    // Handle user joined
    this.eventBus.on('user:joined', async (event) => {
      const { userId, userName } = event.data;
      console.log(`User joined: ${userName}`);

      // Auto-save if versioning enabled
      if (this.config.enableVersioning) {
        this.createSnapshot(event.roomId);
      }
    });

    // Handle document operations
    this.eventBus.on('operation:insert', (event) => {
      this.handleOperation(event);
    });

    this.eventBus.on('operation:delete', (event) => {
      this.handleOperation(event);
    });

    // Handle user left
    this.eventBus.on('user:left', async (event) => {
      const { userId } = event.data;
      console.log(`User left: ${userId}`);

      // Cleanup offline queue
      this.offlineQueue.delete(userId);
    });
  }

  /**
   * Create a new collaborative document
   */
  async createDocument(docId: string, initialContent: string = ''): Promise<DocumentState> {
    // Check if already exists
    if (this.documents.has(docId)) {
      throw new Error(`Document ${docId} already exists`);
    }

    const doc = new CRDTDocument({
      docId,
      initialContent,
    });

    this.documents.set(docId, doc);

    // Auto-save
    if (this.config.enableVersioning) {
      this.createSnapshot(docId);
    }

    return doc.getState();
  }

  /**
   * Get document state
   */
  getDocument(docId: string): DocumentState | null {
    const doc = this.documents.get(docId);
    return doc ? doc.getState() : null;
  }

  /**
   * Get document by ID (full CRDT document)
   */
  getCRDTDocument(docId: string): CRDTDocument | null {
    return this.documents.get(docId) || null;
  }

  /**
   * Load existing document from snapshot
   */
  async loadDocument(snapshot: DocumentSnapshot): Promise<DocumentState> {
    let doc = this.documents.get(snapshot.id);

    if (doc) {
      doc.restoreFromSnapshot(snapshot);
    } else {
      doc = new CRDTDocument({
        docId: snapshot.id,
        initialContent: snapshot.content,
      });
      this.documents.set(snapshot.id, doc);
    }

    return doc.getState();
  }

  /**
   * Apply operation to document
   */
  applyOperation(docId: string, operation: Operation): Promise<Operation | null> {
    return new Promise((resolve) => {
      const doc = this.documents.get(docId);
      if (!doc) {
        resolve(null);
        return;
      }

      try {
        // Transform against pending operations
        const transformed = this.transformOperation(operation, doc);

        // Apply to CRDT
        doc.applyOperation(transformed);

        // Emit event
        this.eventBus.emitEvent({
          type: 'operation:apply',
          roomId: docId,
          userId: operation.userId,
          timestamp: Date.now(),
          data: { operation: transformed },
        });

        resolve(transformed);
      } catch (error) {
        console.error('Failed to apply operation:', error);
        resolve(null);
      }
    });
  }

  /**
   * Batch operations
   */
  async applyBatch(docId: string, batch: BatchOperation): Promise<Operation[]> {
    const doc = this.documents.get(docId);
    if (!doc) return [];

    const results: Operation[] = [];

    for (const op of batch.operations) {
      const transformed = this.transformOperation(op, doc);
      doc.applyOperation(transformed);
      results.push(transformed);
    }

    return results;
  }

  /**
   * Transform operation against document state
   */
  private transformOperation(operation: Operation, doc: CRDTDocument): Operation {
    // Get pending operations
    const history = doc.getHistory();
    const pending = history.filter((h) => h.userId === operation.userId && !h.serverTimestamp);

    // Transform against each pending op
    let transformed = { ...operation };

    for (const pendingOp of pending) {
      if (pendingOp.id !== transformed.id) {
        const [t1, t2] = this.otEngine.transform(pendingOp, transformed, 'left');
        transformed = t2;
      }
    }

    // Adjust position based on conflicts
    transformed.position = this.normalizePosition(transformed.position, doc.getLength());

    return transformed;
  }

  /**
   * Normalize position to document bounds
   */
  private normalizePosition(position: number, docLength: number): number {
    return Math.max(0, Math.min(position, docLength));
  }

  /**
   * Handle operation event
   */
  private handleOperation(event: CollabEvent): void {
    const { roomId, userId, data } = event;
    const doc = this.documents.get(roomId);

    if (!doc || !data.operation) return;

    // Apply operation
    this.applyOperation(roomId, data.operation);

    // Broadcast to room
    this.broadcastToRoom(roomId, 'operation', data);
  }

  /**
   * Create document snapshot (backup)
   */
  createSnapshot(docId: string): DocumentSnapshot | null {
    const doc = this.documents.get(docId);
    if (!doc) return null;

    const snapshot = doc.createSnapshot();

    // Store snapshot (in production, persist to database)
    this.persistSnapshot(docId, snapshot);

    return snapshot;
  }

  /**
   * Persist snapshot (stub for database persistence)
   */
  private async persistSnapshot(docId: string, snapshot: DocumentSnapshot): Promise<void> {
    // In production, save to Postgres/S3
    console.log(`✓ Snapshot saved for ${docId}`);
  }

  /**
   * Create collaboration room
   */
  async createRoom(config: RoomConfig): Promise<Room> {
    // Register document with manager only if not already present
    if (!this.documents.has(config.documentId)) {
      await this.createDocument(config.documentId);
    }

    // Create room via room manager
    const room = this.roomManager.createRoom(config);

    this.eventBus.emitEvent({
      type: 'room:created',
      roomId: room.id,
      userId: '', // System
      timestamp: Date.now(),
      data: { room },
    });

    return room;
  }

  /**
   * Join room
   */
  async joinRoom(roomId: string, userId: string, userName: string): Promise<boolean> {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return false;

    // Ensure user has presence
    const presence = this.presenceManager.initializeUser(userId, userName, this.generateColor());

    // Join via room manager
    const success = this.roomManager.joinRoom(roomId, {
      userId,
      userName,
      email: '',
      color: presence.userColor,
      cursor: null,
    });

    if (success) {
      this.eventBus.emitEvent({
        type: 'room:joined',
        roomId,
        userId,
        timestamp: Date.now(),
        data: { room, participants: this.roomManager.getParticipants(roomId) },
      });
    }

    return success;
  }

  /**
   * Leave room
   */
  leaveRoom(roomId: string, userId: string): void {
    this.roomManager.leaveRoom(roomId, userId);
    this.presenceManager.removeUser(userId);

    this.eventBus.emitEvent({
      type: 'room:left',
      roomId,
      userId,
      timestamp: Date.now(),
      data: {},
    });
  }

  /**
   * Broadcast to room
   */
  private broadcastToRoom(roomId: string, event: string, data: any): void {
    if (!this.wsServer) return;

    this.wsServer.getIO().to(roomId).emit(event, {
      ...data,
      roomId,
      timestamp: Date.now(),
    });
  }

  /**
   * Queue offline changes
   */
  enqueueOfflineChanges(userId: string, changes: OfflineChange[]): void {
    const queue = this.offlineQueue.get(userId) || [];
    queue.push(...changes);
    this.offlineQueue.set(userId, queue.slice(-1000)); // Keep last 1000
  }

  /**
   * Get offline queue for user
   */
  getOfflineQueue(userId: string): OfflineChange[] {
    return this.offlineQueue.get(userId) || [];
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue(userId: string): void {
    this.offlineQueue.delete(userId);
  }

   /**
    * Get room by ID
    */
   getRoom(roomId: string): Room | undefined {
     return this.roomManager.getRoom(roomId);
   }

   /**
    * Get all rooms
    */
   getAllRooms(): Room[] {
     return this.roomManager.getAllRooms();
   }

  /**
   * Get WebSocket server instance
   */
  getWebSocketServer(): WebSocketServer | undefined {
    return this.wsServer;
  }

  /**
   * Generate invite token for a room
   */
  generateInviteToken(roomId: string, createdBy: string): string {
    return this.roomManager.generateInviteToken(roomId, createdBy);
  }

  /**
   * Use invite token to join room
   */
  useInviteToken(token: string, userId: string, userName: string): boolean {
    const presence: UserPresence = {
      userId,
      userName,
      email: '',
      color: this.generateColor(),
      cursor: null,
    };

    return this.roomManager.useInviteToken(token, presence);
  }

  /**
   * Get statistics
   */
  getStats(): {
    documents: number;
    rooms: number;
    activeUsers: number;
    offlineQueues: number;
  } {
    return {
      documents: this.documents.size,
      rooms: this.roomManager.getAllRooms().length,
      activeUsers: this.presenceManager.getStats().activeUsers,
      offlineQueues: this.offlineQueue.size,
    };
  }

  /**
   * Generate color for user
   */
  private generateColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.wsServer) {
      this.wsServer.shutdown();
    }

    this.eventBus.shutdown();
    this.presenceManager.clear();
    this.roomManager.shutdown();

    this.documents.forEach((doc) => doc.destroy());
    this.documents.clear();

    console.log('Collaboration manager stopped');
  }
}

// Singleton instance
let collaborationManager: CollaborationManager | null = null;

export function getCollaborationManager(config?: CollaborationConfig): CollaborationManager {
  if (!collaborationManager) {
    collaborationManager = new CollaborationManager(config);
  }
  return collaborationManager;
}

/**
 * Export utilities
 */
export { CRDTDocument } from '../crdt/crdt-document';
export { OperationalTransformer } from '../crdt/operational-transformer';
export { RoomManager } from './room-manager';
export { PresenceManager } from './presence-manager';
export { EventBus } from './event-bus';
export * from '../types/collab.types';
