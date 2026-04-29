/**
 * Core types for the real-time collaboration system
 */

export interface UserPresence {
  userId: string;
  userName: string;
  userColor: string;
  cursor: CursorPosition | null;
  selection: SelectionRange | null;
  isActive: boolean;
  lastSeen: number;
  platform?: 'desktop' | 'web' | 'mobile';
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface Operation {
  type: 'insert' | 'delete' | 'retain' | 'replace';
  position: number;
  length?: number;
  content?: string;
  userId: string;
  timestamp: number;
  version: number;
  id: string;
}

export interface DocumentState {
  id: string;
  content: string;
  version: number;
  checksum: string;
  collaborators: UserPresence[];
  lastModified: number;
  lastModifiedBy: string;
  isReadOnly: boolean;
}

export interface Room {
  id: string;
  name: string;
  documentId: string;
  participants: Map<string, UserPresence>;
  permissions: RoomPermissions;
  createdAt: number;
  lastActivity: number;
  isPublic: boolean;
  maxUsers: number;
}

export interface RoomPermissions {
  canEdit: boolean;
  canInvite: boolean;
  canKick: boolean;
  canChangePermissions: boolean;
}

export interface CollabEvent {
  type: CollabEventType;
  roomId: string;
  userId: string;
  timestamp: number;
  data: any;
}

export type CollabEventType =
  | 'user:joined'
  | 'user:left'
  | 'user:update'
  | 'cursor:move'
  | 'selection:change'
  | 'operation:insert'
  | 'operation:delete'
  | 'operation:replace'
  | 'document:load'
  | 'document:save'
  | 'room:create'
  | 'room:join'
  | 'room:leave'
  | 'room:update'
  | 'presence:broadcast'
  | 'conflict:detected'
  | 'conflict:resolved'
  | 'offline:sync'
  | 'version:update';

export interface SocketCustomData {
  socketId: string;
  userId: string;
  userName: string;
  roomId?: string;
  userColor: string;
  latency?: number;
}

export interface ClientAck {
  success: boolean;
  message?: string;
  data?: any;
  timestamp: number;
}

export interface OfflineChange {
  id: string;
  operation: Operation;
  clientTimestamp: number;
  serverTimestamp?: number;
  status: 'pending' | 'synced' | 'conflict';
}

export interface VersionVector {
  [userId: string]: number;
}

export interface DocumentSnapshot {
  id: string;
  content: string;
  version: number;
  vector: VersionVector;
  checksum: string;
  createdAt: number;
  createdBy: string;
}
