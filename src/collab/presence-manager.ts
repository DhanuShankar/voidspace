/**
 * Presence Manager
 * Handles real-time cursor and selection tracking
 */

import { UserPresence, CursorPosition, SelectionRange, CollabEvent } from '../types/collab.types';
import { EventEmitter } from 'events';

export interface PresenceUpdate {
  userId: string;
  cursor: CursorPosition | null;
  selection: SelectionRange | null;
  timestamp: number;
}

export interface PresenceState {
  users: Map<string, UserPresence>;
  lastUpdate: number;
}

export class PresenceManager extends EventEmitter {
  private state: PresenceState;
  private readonly TIMEOUT_MS = 30000; // 30 seconds timeout
  private readonly BROADCAST_INTERVAL = 100; // 10 Hz updates
  private broadcastTimer: NodeJS.Timeout | null = null;
  private pendingUpdates: Map<string, PresenceUpdate> = new Map();

  constructor() {
    super();
    this.state = {
      users: new Map(),
      lastUpdate: Date.now(),
    };
  }

  /**
   * Initialize user presence
   */
  initializeUser(userId: string, userName: string, userColor: string): UserPresence {
    const presence: UserPresence = {
      userId,
      userName,
      userColor,
      cursor: null,
      selection: null,
      isActive: true,
      lastSeen: Date.now(),
      platform: 'web',
    };

    this.state.users.set(userId, presence);
    this.emit('user:joined', presence);

    this.startBroadcast();
    return presence;
  }

  /**
   * Update cursor position
   */
  updateCursor(userId: string, cursor: CursorPosition): void {
    const user = this.state.users.get(userId);
    if (!user) return;

    user.cursor = cursor;
    user.lastSeen = Date.now();

    const update: PresenceUpdate = {
      userId,
      cursor,
      selection: user.selection,
      timestamp: Date.now(),
    };

    this.queueUpdate(update);
  }

  /**
   * Update text selection
   */
  updateSelection(userId: string, selection: SelectionRange): void {
    const user = this.state.users.get(userId);
    if (!user) return;

    user.selection = selection;
    user.lastSeen = Date.now();

    const update: PresenceUpdate = {
      userId,
      cursor: user.cursor,
      selection,
      timestamp: Date.now(),
    };

    this.queueUpdate(update);
  }

  /**
   * Mark user as inactive after timeout
   */
  markInactive(userId: string): void {
    const user = this.state.users.get(userId);
    if (user) {
      user.isActive = false;
      this.emit('user:left', user);
    }
  }

  /**
   * Check inactive users periodically
   */
  checkInactiveUsers(): void {
    const now = Date.now();
    this.state.users.forEach((user, userId) => {
      if (now - user.lastSeen > this.TIMEOUT_MS && user.isActive) {
        user.isActive = false;
        this.emit('user:left', user);
      }
    });
  }

  /**
   * Remove user completely
   */
  removeUser(userId: string): void {
    const user = this.state.users.get(userId);
    if (user) {
      user.isActive = false;
      this.emit('user:left', user);
      this.state.users.delete(userId);
      this.pendingUpdates.delete(userId);
    }
  }

  /**
   * Get active users
   */
  getActiveUsers(): UserPresence[] {
    return Array.from(this.state.users.values()).filter((u) => u.isActive);
  }

  /**
   * Get user presence
   */
  getUser(userId: string): UserPresence | undefined {
    return this.state.users.get(userId);
  }

  /**
   * Get all users
   */
  getAllUsers(): UserPresence[] {
    return Array.from(this.state.users.values());
  }

  /**
   * Get cursor positions for broadcast
   */
  getCursorPositions(): Record<string, { cursor: CursorPosition | null; selection: SelectionRange | null }> {
    const positions: Record<string, { cursor: CursorPosition | null; selection: SelectionRange | null }> = {};

    this.state.users.forEach((user, userId) => {
      positions[userId] = {
        cursor: user.cursor,
        selection: user.selection,
      };
    });

    return positions;
  }

  /**
   * Broadcast presence periodically
   */
  private startBroadcast(): void {
    if (this.broadcastTimer) return;

    this.broadcastTimer = setInterval(() => {
      this.checkInactiveUsers();
      this.flushUpdates();
    }, this.BROADCAST_INTERVAL);
  }

  /**
   * Stop broadcasting
   */
  stopBroadcast(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  /**
   * Queue an update for batch processing
   */
  private queueUpdate(update: PresenceUpdate): void {
    this.pendingUpdates.set(update.userId, update);
  }

  /**
   * Flush all pending updates
   */
  private flushUpdates(): void {
    if (this.pendingUpdates.size === 0) return;

    const updates = Array.from(this.pendingUpdates.values());
    this.pendingUpdates.clear();

    // Emit compact presence broadcast
    const event: CollabEvent = {
      type: 'presence:broadcast',
      roomId: '',
      userId: '',
      timestamp: Date.now(),
      data: { updates },
    };

    this.emit('presence:update', event);
  }

  /**
   * Get presence state
   */
  getState(): PresenceState {
    return {
      users: new Map(this.state.users),
      lastUpdate: this.state.lastUpdate,
    };
  }

  /**
   * Clear all presence
   */
  clear(): void {
    this.stopBroadcast();
    this.state.users.clear();
    this.pendingUpdates.clear();
  }

  /**
   * Get statistics
   */
  getStats(): { activeUsers: number; totalUsers: number } {
    const active = this.getActiveUsers().length;
    const total = this.state.users.size;
    return { activeUsers: active, totalUsers: total };
  }
}

// Singleton instance
export const presenceManager = new PresenceManager();

/**
 * Throttle cursor updates
 */
export function throttleCursorUpdates(
  callback: (cursor: CursorPosition) => void,
  delay: number = 50
): (cursor: CursorPosition) => void {
  let lastCall = 0;
  return (cursor: CursorPosition) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      callback(cursor);
    }
  };
}

/**
 * Debounce cursor updates
 */
export function debounceCursorUpdates(
  callback: (cursor: CursorPosition) => void,
  delay: number = 100
): (cursor: CursorPosition) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  return (cursor: CursorPosition) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(cursor), delay);
  };
}
