/**
 * Room Manager
 * Handles collaboration rooms, access control, and user management
 */

import { Room, RoomPermissions, UserPresence, CollabEvent } from '../types/collab.types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface RoomConfig {
  name?: string;
  documentId: string;
  isPublic?: boolean;
  maxUsers?: number;
  permissions?: Partial<RoomPermissions>;
}

export interface InviteToken {
  token: string;
  roomId: string;
  expiresAt: number;
  createdBy: string;
  used: boolean;
}

export class RoomManager extends EventEmitter {
  private rooms: Map<string, Room> = new Map();
  private roomMembers: Map<string, Map<string, UserPresence>> = new Map();
  private inviteTokens: Map<string, InviteToken> = new Map();
  private defaultPermissions: RoomPermissions = {
    canEdit: true,
    canInvite: false,
    canKick: false,
    canChangePermissions: false,
  };

  constructor() {
    super();
  }

  /**
   * Create a new collaboration room
   */
  createRoom(config: RoomConfig): Room {
    const roomId = uuidv4();
    const now = Date.now();

    const room: Room = {
      id: roomId,
      name: config.name || `Room ${roomId.slice(0, 8)}`,
      documentId: config.documentId,
      participants: new Map(),
      permissions: { ...this.defaultPermissions, ...config.permissions },
      createdAt: now,
      lastActivity: now,
      isPublic: config.isPublic ?? false,
      maxUsers: config.maxUsers || 50,
    };

    this.rooms.set(roomId, room);
    this.roomMembers.set(roomId, new Map());

    this.emit('room:created', room);
    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Join a room
   */
  joinRoom(roomId: string, user: UserPresence): boolean {
    const room = this.rooms.get(roomId);
    const members = this.roomMembers.get(roomId);

    if (!room || !members) return false;

    // Check if room is full
    if (members.size >= room.maxUsers) {
      this.emit('room:full', { roomId, userId: user.userId });
      return false;
    }

    // Check permissions
    if (!this.canJoinRoom(room, user)) {
      this.emit('room:access_denied', { roomId, userId: user.userId });
      return false;
    }

    room.participants.set(user.userId, user);
    members.set(user.userId, user);
    room.lastActivity = Date.now();

    this.emit('user:joined', { roomId, user });
    return true;
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    const members = this.roomMembers.get(roomId);

    if (!room || !members) return;

    room.participants.delete(userId);
    members.delete(userId);
    room.lastActivity = Date.now();

    this.emit('user:left', { roomId, userId });
  }

  /**
   * Check if user can join room
   */
  private canJoinRoom(room: Room, user: UserPresence): boolean {
    if (room.isPublic) return true;
    // Add additional checks: invite tokens, member lists, etc.
    return true;
  }

  /**
   * Get room participants
   */
  getParticipants(roomId: string): UserPresence[] {
    const participants = this.roomMembers.get(roomId);
    return participants ? Array.from(participants.values()) : [];
  }

  /**
   * Check if user is in room
   */
  isUserInRoom(roomId: string, userId: string): boolean {
    const participants = this.roomMembers.get(roomId);
    return participants ? participants.has(userId) : false;
  }

  /**
   * Get user's rooms
   */
  getUserRooms(userId: string): Room[] {
    const result: Room[] = [];
    this.rooms.forEach((room) => {
      if (room.participants.has(userId)) {
        result.push(room);
      }
    });
    return result;
  }

  /**
   * Update room permissions
   */
  updatePermissions(roomId: string, permissions: Partial<RoomPermissions>, byUserId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Check if user has permission to change permissions
    const invoker = room.participants.get(byUserId);
    if (!invoker || !room.permissions.canChangePermissions) {
      return false;
    }

    room.permissions = { ...room.permissions, ...permissions };
    this.emit('room:updated', room);
    return true;
  }

  /**
   * Kick user from room
   */
  kickUser(roomId: string, targetUserId: string, byUserId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const invoker = room.participants.get(byUserId);
    if (!invoker || !room.permissions.canKick) {
      return false;
    }

    this.leaveRoom(roomId, targetUserId);
    this.emit('user:kicked', { roomId, userId: targetUserId, kickedBy: byUserId });
    return true;
  }

  /**
   * Invite user to room via token
   */
  generateInviteToken(roomId: string, createdBy: string, expiresInMs: number = 86400000): string {
    const token = uuidv4();
    const expiresAt = Date.now() + expiresInMs;

    const invite: InviteToken = {
      token,
      roomId,
      expiresAt,
      createdBy,
      used: false,
    };

    this.inviteTokens.set(token, invite);
    return token;
  }

  /**
   * Validate and use invite token
   */
  useInviteToken(token: string, user: UserPresence): boolean {
    const invite = this.inviteTokens.get(token);
    if (!invite || invite.used || Date.now() > invite.expiresAt) {
      return false;
    }

    const success = this.joinRoom(invite.roomId, user);
    if (success) {
      invite.used = true;
      this.emit('invite:used', { token, roomId: invite.roomId, userId: user.userId });
    }
    return success;
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get public rooms
   */
  getPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter((room) => room.isPublic);
  }

  /**
   * Destroy room
   */
  destroyRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      // Notify all participants
      room.participants.forEach((_, userId) => {
        this.emit('room:destroyed', { roomId, userId });
      });

      this.rooms.delete(roomId);
      this.roomMembers.delete(roomId);

      // Clean up expired invite tokens
      this.inviteTokens.forEach((invite) => {
        if (invite.roomId === roomId) {
          this.inviteTokens.delete(invite.token);
        }
      });
    }
  }

  /**
   * Get room statistics
   */
  getRoomStats(roomId: string): { participantCount: number; maxUsers: number } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      participantCount: room.participants.size,
      maxUsers: room.maxUsers,
    };
  }

  /**
   * Update user activity
   */
  updateActivity(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (room && room.participants.has(userId)) {
      room.lastActivity = Date.now();
    }
  }

  /**
   * Get idle rooms (no activity for 1 hour)
   */
  getIdleRooms(): Room[] {
    const oneHourAgo = Date.now() - 3600000;
    return Array.from(this.rooms.values()).filter(
      (room) => room.lastActivity < oneHourAgo
    );
  }

  /**
   * Clean up idle rooms
   */
  cleanupIdleRooms(): void {
    const idleRooms = this.getIdleRooms();
    idleRooms.forEach((room) => {
      console.log(`Cleaning up idle room: ${room.id}`);
      this.destroyRoom(room.id);
    });
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    this.rooms.forEach((room) => {
      room.participants.forEach((_, userId) => {
        this.emit('room:destroyed', { roomId: room.id, userId });
      });
    });

    this.rooms.clear();
    this.roomMembers.clear();
    this.inviteTokens.clear();
  }

  /**
   * Get statistics
   */
  getStats(): { totalRooms: number; totalParticipants: number } {
    let totalParticipants = 0;
    this.rooms.forEach((room) => {
      totalParticipants += room.participants.size;
    });

    return {
      totalRooms: this.rooms.size,
      totalParticipants,
    };
  }
}

// Singleton instance
export const roomManager = new RoomManager();

/**
 * Decorator for room check
 */
export function withRoomCheck(fn: Function): Function {
  return function (this: any, roomId: string, ...args: any[]) {
    if (!roomManager.getRoom(roomId)) {
      throw new Error(`Room ${roomId} not found`);
    }
    return fn.apply(this, [roomId, ...args]);
  };
}
