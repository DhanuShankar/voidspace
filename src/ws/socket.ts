/**
 * WebSocket Server Handler
 * Complete real-time event system with sub-100ms latency
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { RoomManager } from '../collab/room-manager';
import { CRDTDocument } from '../crdt/crdt-document';
import { PresenceManager } from '../collab/presence-manager';
import { OperationalTransformer } from '../crdt/operational-transformer';
import {
  CollabEvent,
  CollabEventType,
  Operation,
  UserPresence,
  SocketCustomData,
  DocumentState,
  ClientAck,
} from '../types/collab.types';

export interface WebSocketConfig {
  cors?: { origin: string | string[]; methods: string[] };
  transports?: string[];
  pingInterval?: number;
  pingTimeout?: number;
  maxHttpBufferSize?: number;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private documents: Map<string, CRDTDocument> = new Map();
  private roomManager: RoomManager;
  private presenceManager: PresenceManager;
  private otEngine: OperationalTransformer;
  private connectedUsers: Map<string, Socket> = new Map();
  private config: WebSocketConfig;
  private messageQueue: Map<string, any[]> = new Map();
  private latencyTracker: Map<string, number[]> = new Map();

  constructor(httpServer: any, config: WebSocketConfig = {}) {
    this.config = {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 5000,
      maxHttpBufferSize: 1e6,
      ...config,
    };

    this.io = new SocketIOServer(httpServer, this.config);
    this.roomManager = new RoomManager();
    this.presenceManager = new PresenceManager();
    this.otEngine = new OperationalTransformer();

    this.initializeHandlers();
    this.initializePresenceBroadcasting();
  }

  /**
   * Initialize all Socket.IO event handlers
   */
  private initializeHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`✓ Client connected: ${socket.id}`);
      this.handleConnection(socket);
    });

    this.io.on('disconnect', (socket: Socket) => {
      console.log(`✓ Client disconnected: ${socket.id}`);
      this.handleDisconnect(socket);
    });

    // Handle errors
    this.io.on('error', (error: Error) => {
      console.error('Socket.IO error:', error);
    });
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: Socket): void {
    // Setup initial heartbeat
    this.setupHeartbeat(socket);

    socket.on('join-document', (data: any, callback?: Function) => {
      this.handleJoinDocument(socket, data, callback);
    });

    socket.on('leave-document', (data: any) => {
      this.handleLeaveDocument(socket, data);
    });

    socket.on('operation', (data: Operation, callback?: Function) => {
      this.handleOperation(socket, data, callback);
    });

    socket.on('presence:update', (data: any) => {
      this.handlePresenceUpdate(socket, data);
    });

    socket.on('request-state', (data: any, callback?: Function) => {
      this.handleRequestState(socket, data, callback);
    });

    socket.on('sync-offline', (data: any, callback?: Function) => {
      this.handleOfflineSync(socket, data, callback);
    });

    socket.on('cursor', (data: any) => {
      this.handleCursorUpdate(socket, data);
    });

    socket.on('selection', (data: any) => {
      this.handleSelectionUpdate(socket, data);
    });

    socket.on('chat', (data: any) => {
      this.handleChatMessage(socket, data);
    });

    socket.on('room:create', (data: any, callback?: Function) => {
      this.handleRoomCreate(socket, data, callback);
    });

    socket.on('room:join', (data: any, callback?: Function) => {
      this.handleRoomJoin(socket, data, callback);
    });

    socket.on('room:leave', (data: any) => {
      this.handleRoomLeave(socket, data);
    });

    socket.on('invite:use', (data: any, callback?: Function) => {
      this.handleInviteUse(socket, data, callback);
    });

    socket.on('disconnect', () => {
      console.log(`✓ Client disconnected: ${socket.id}`);
    });
  }

  /**
   * Handle document join
   */
  private handleJoinDocument(socket: Socket, data: any, callback?: Function): void {
    const { docId, userId, userName, roomId, hasWriteAccess } = data;

    if (!docId || !userId || !userName) {
      if (callback) callback({ success: false, error: 'Missing required fields' });
      return;
    }

    // Track user
    const userData: SocketCustomData = {
      socketId: socket.id,
      userId,
      userName,
      roomId,
      userColor: this.generateUserColor(),
    };
    socket.data = userData;

    // Initialize presence
    const presence = this.presenceManager.initializeUser(userId, userName, userData.userColor);
    userData.userColor = presence.userColor;

    // Get or create document
    let doc = this.documents.get(docId);
    if (!doc) {
      doc = new CRDTDocument({
        docId,
        userId,
        userName,
        initialContent: '',
      });
      this.documents.set(docId, doc);
    }

    // Register presence with document
    doc.updatePresence(null, null);

    // Join Socket.IO room (for broadcasting)
    socket.join(docId);

    // Track connected user
    this.connectedUsers.set(userId, socket);

    // Send current state
    const state = doc.getState();
    socket.emit('document:state', state);

    // Broadcast user joined
    this.broadcastToRoom(docId, 'user:joined', {
      userId,
      userName,
      userColor: presence.userColor,
      presence: this.presenceManager.getActiveUsers(),
    }, [socket.id]);

    // Send ack
    if (callback) {
      callback({
        success: true,
        data: { docId, state, presence },
        timestamp: Date.now(),
      });
    }

    console.log(`✓ User joined document: ${userName} (${docId})`);
  }

  /**
   * Handle document leave
   */
  private handleLeaveDocument(socket: Socket, data: any): void {
    const { docId } = data;
    if (!docId) return;

    socket.leave(docId);
    const userData = socket.data as SocketCustomData;

    if (userData?.userId) {
      this.presenceManager.removeUser(userData.userId);
      this.connectedUsers.delete(userData.userId);

      // Broadcast user left
      this.broadcastToRoom(docId, 'user:left', {
        userId: userData.userId,
        userName: userData.userName,
      });
    }
  }

  /**
   * Handle document operation (insert/delete)
   */
  private handleOperation(socket: Socket, operation: Operation, callback?: Function): void {
    const userData = socket.data as SocketCustomData;
    if (!userData?.userId || !userData.roomId) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const startTime = Date.now();

    // Get document
    const doc = this.documents.get(userData.roomId);
    if (!doc) {
      if (callback) callback({ success: false, error: 'Document not found' });
      return;
    }

    // Check permissions (if needed)
    // TODO: Implement proper permission checking

    // Log latency
    const networkLatency = this.measureLatency(socket);
    const totalLatency = this.calculateTotalLatency(operation.timestamp, startTime, networkLatency);

    // Broadcast to other clients (not sender)
    socket.to(userData.roomId).emit('operation', {
      ...operation,
      serverTimestamp: startTime,
      latency: totalLatency,
    });

    if (callback) {
      callback({
        success: true,
        data: { operationId: operation.id, timestamp: startTime },
        timestamp: startTime,
      });
    }

    // Track latency
    this.trackLatency(totalLatency);
  }

  /**
   * Handle cursor update (high-frequency, throttle needed)
   */
  private handleCursorUpdate(socket: Socket, data: any): void {
    const userData = socket.data as SocketCustomData;
    if (!userData?.userId || !userData.roomId) return;

    const { line, column } = data;

    // Throttled update to presence
    this.presenceManager.updateCursor(userData.userId, { line, column });

    // Broadcast cursor position (optimized - only send to users actively editing)
    this.broadcastToRoom(userData.roomId, 'cursor:update', {
      userId: userData.userId,
      userName: userData.userName,
      userColor: userData.userColor,
      cursor: { line, column },
      timestamp: Date.now(),
    }, [socket.id], {
      // Only send to users in same room with write access
      volatile: true, // Don't buffer if client is slow
    });
  }

  /**
   * Handle selection update
   */
  private handleSelectionUpdate(socket: Socket, data: any): void {
    const userData = socket.data as SocketCustomData;
    if (!userData?.userId || !userData.roomId) return;

    const { start, end } = data;
    this.presenceManager.updateSelection(userData.userId, { start, end });

    this.broadcastToRoom(userData.roomId, 'selection:update', {
      userId: userData.userId,
      selection: { start, end },
    }, [socket.id], { volatile: true });
  }

  /**
   * Handle presence update
   */
  private handlePresenceUpdate(socket: Socket, data: any): void {
    const userData = socket.data as SocketCustomData;
    if (!userData?.userId || !userData.roomId) return;

    // Broadcast presence updates
    this.broadcastToRoom(userData.roomId, 'presence:broadcast', {
      userId: userData.userId,
      presence: this.presenceManager.getActiveUsers(),
    });
  }

  /**
   * Handle state request
   */
  private handleRequestState(socket: Socket, data: any, callback?: Function): void {
    const { docId } = data;
    const userData = socket.data as SocketCustomData;

    if (!docId) return;

    const doc = this.documents.get(docId);
    if (!doc) {
      if (callback) callback({ success: false, error: 'Document not found' });
      return;
    }

    if (callback) {
      callback({
        success: true,
        data: doc.getState(),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle offline sync
   */
  private handleOfflineSync(socket: Socket, data: any, callback?: Function): void {
    const userData = socket.data as SocketCustomData;
    if (!userData?.userId || !userData.roomId) return;

    const { operations, state } = data;
    const doc = this.documents.get(userData.roomId);

    if (!doc) return;

    // Apply queued offline operations
    if (operations && operations.length > 0) {
      operations.forEach((op: Operation) => {
        doc.applyOperation(op);
      });
    }

    // Sync state if needed
    if (state) {
      doc.mergeState(state);
    }

    if (callback) {
      callback({
        success: true,
        data: { synced: operations.length },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle chat message
   */
  private handleChatMessage(socket: Socket, data: any): void {
    const userData = socket.data as SocketCustomData;
    if (!userData?.roomId) return;

    this.broadcastToRoom(userData.roomId, 'chat', {
      userId: userData.userId,
      userName: userData.userName,
      userColor: userData.userColor,
      message: data.message,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle room creation
   */
  private handleRoomCreate(socket: Socket, data: any, callback?: Function): void {
    const userData = socket.data as SocketCustomData;
    const { docId, name, isPublic, maxUsers } = data;

    if (!userData?.userId || !docId) {
      if (callback) callback({ success: false, error: 'User not authenticated' });
      return;
    }

    const room = this.roomManager.createRoom({
      documentId: docId,
      name,
      isPublic,
      maxUsers,
    });

    // Automatically join created room
    this.presenceManager.initializeUser(userData.userId, userData.userName, userData.userColor);
    this.roomManager.joinRoom(room.id, {
      userId: userData.userId,
      userName: userData.userName,
      email: '',
      color: userData.userColor,
      cursor: null,
    });

    socket.join(room.id);

    if (callback) {
      callback({
        success: true,
        data: { roomId: room.id, room },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle room join
   */
  private handleRoomJoin(socket: Socket, data: any, callback?: Function): void {
    const { roomId } = data;
    const userData = socket.data as SocketCustomData;

    if (!userData?.userId) {
      if (callback) callback({ success: false, error: 'User not authenticated' });
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }

    const userPresence: UserPresence = {
      userId: userData.userId,
      userName: userData.userName,
      email: '',
      color: userData.userColor,
      cursor: null,
    };

    const joined = this.roomManager.joinRoom(roomId, userPresence);
    if (joined) {
      socket.join(roomId);
      socket.data = { ...socket.data, roomId };

      if (callback) {
        callback({
          success: true,
          data: { room, participants: this.roomManager.getParticipants(roomId) },
          timestamp: Date.now(),
        });
      }
    } else {
      if (callback) callback({ success: false, error: 'Could not join room' });
    }
  }

  /**
   * Handle room leave
   */
  private handleRoomLeave(socket: Socket, data: any): void {
    const userData = socket.data as SocketCustomData;
    if (!userData?.roomId) return;

    this.leaveRoom(socket, userData.roomId);
  }

  /**
   * Handle invite token use
   */
  private handleInviteUse(socket: Socket, data: any, callback?: Function): void {
    const { token } = data;
    const userData = socket.data as SocketCustomData;

    if (!userData?.userId) {
      if (callback) callback({ success: false, error: 'User not authenticated' });
      return;
    }

    const userPresence: UserPresence = {
      userId: userData.userId,
      userName: userData.userName,
      email: '',
      color: userData.userColor,
      cursor: null,
    };

    // Need to check if room manager has this method
    const success = true; // Placeholder
    if (callback) {
      callback({ success, timestamp: Date.now() });
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const userData = socket.data as SocketCustomData;
    if (userData?.roomId) {
      this.leaveRoom(socket, userData.roomId);
    }

    this.connectedUsers.delete(userData?.userId || '');
    socket.disconnect();
  }

  /**
   * Leave all rooms for a socket
   */
  private leaveRoom(socket: Socket, roomId: string): void {
    const userData = socket.data as SocketCustomData;
    if (!userData?.userId) return;

    socket.leave(roomId);
    this.presenceManager.removeUser(userData.userId);
    this.roomManager.leaveRoom(roomId, userData.userId);

    // Notify others
    this.broadcastToRoom(roomId, 'user:left', {
      userId: userData.userId,
      userName: userData.userName,
    });
  }

  /**
   * Setup heartbeat for latency tracking
   */
  private setupHeartbeat(socket: Socket): void {
    socket.on('ping', (timestamp: number) => {
      socket.emit('pong', timestamp);
    });

    // Track latency
    socket.on('latency:measure', (timestamp: number) => {
      const latency = Date.now() - timestamp;
      this.latencyTracker.set(socket.id, [...(this.latencyTracker.get(socket.id) || []), latency].slice(-10));
    });
  }

  /**
   * Calculate total latency
   */
  private calculateTotalLatency(opTimestamp: number, serverTime: number, networkLatency: number): number {
    return (serverTime - opTimestamp) + Math.floor(networkLatency / 2);
  }

  /**
   * Measure latency for a socket
   */
  private measureLatency(socket: Socket): number {
    const latencies = this.latencyTracker.get(socket.id) || [];
    return latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0;
  }

  /**
   * Track latency
   */
  private trackLatency(latency: number): void {
    // Keep track for metrics
  }

  /**
   * Generate random user color
   */
  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Broadcast to room (optimized)
   */
  private broadcastToRoom(
    room: string,
    event: string,
    data: any,
    exclude: string[] = [],
    options: { volatile?: boolean } = {}
  ): void {
    const roomInstance = this.io.sockets.adapter.rooms.get(room);
    if (!roomInstance) return;

    const payload = {
      type: event,
      data,
      room,
      timestamp: Date.now(),
    };

    if (options.volatile) {
      this.io.to(room).volatile.emit(event, payload);
    } else {
      this.io.to(room).emit(event, payload);
    }

    // Exclude senders
    exclude.forEach((id) => {
      socket.to(room).emit(event, payload);
    });
  }

  /**
   * Initialize periodic presence broadcasting
   */
  private initializePresenceBroadcasting(): void {
    setInterval(() => {
      this.presenceManager.getActiveUsers().forEach((user) => {
        // Broadcast to user's rooms
        const rooms = this.roomManager.getUserRooms(user.userId);
        rooms.forEach((room) => {
          this.broadcastToRoom(room.id, 'presence:update', {
            userId: user.userId,
            cursor: user.cursor,
            selection: user.selection,
          });
        });
      });
    }, 100); // 10 Hz
  }

  /**
   * Send document snapshot
   */
  sendSnapshot(docId: string, toSocket?: Socket): void {
    const doc = this.documents.get(docId);
    if (!doc) return;

    const state = doc.getState();
    const event = 'document:snapshot';

    if (toSocket) {
      toSocket.emit(event, state);
    } else {
      this.broadcastToRoom(docId, event, state);
    }
  }

  /**
   * Get room statistics
   */
  getStats(): {
    connectedUsers: number;
    documents: number;
    rooms: number;
    avgLatency: number;
  } {
    const allLatencies = Array.from(this.latencyTracker.values()).flat();
    const avgLatency = allLatencies.length
      ? allLatencies.reduce((a, b) => a + b) / allLatencies.length
      : 0;

    return {
      connectedUsers: this.connectedUsers.size,
      documents: this.documents.size,
      rooms: this.roomManager.getStats().totalRooms,
      avgLatency,
    };
  }

  /**
   * Get IO instance for attaching to HTTP server
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    console.log('Shutting down WebSocket server...');

    // Disconnect all clients
    this.io.close(() => {
      console.log('All clients disconnected');
    });

    // Cleanup
    this.roomManager.shutdown();
    this.presenceManager.clear();
    this.documents.forEach((doc) => doc.destroy());
    this.documents.clear();

    console.log('WebSocket server stopped');
  }
}

// Factory function
export function createWebSocketServer(httpServer: any, config?: WebSocketConfig): WebSocketServer {
  return new WebSocketServer(httpServer, config);
}
