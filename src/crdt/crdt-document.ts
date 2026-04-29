/**
 * Yjs-inspired CRDT Document Manager
 * Uses Automerge under the hood with Yjs-compatible structures
 */

import * as Automerge from 'automerge';
import {
  DocumentState,
  Operation,
  UserPresence,
  CursorPosition,
  VersionVector,
  DocumentSnapshot,
} from '../types/collab.types';

export interface CRDTDocumentOptions {
  docId: string;
  initialContent?: string;
  userId?: string;
  userName?: string;
}

export interface DeltaOperation {
  insert?: { index: number; content: string };
  delete?: { index: number; length: number };
  retain?: number;
}

export class CRDTDocument {
  private doc: any = null;
  private docId: string;
  private userId: string;
  private userName: string;
  private userColor: string;
  private changeCallbacks: Array<(state: DocumentState) => void> = [];
  private localChanges: Operation[] = [];
  private remoteChanges: Operation[] = [];
  private versionVector: VersionVector = {};
  private encodingQueue: DeltaOperation[] = [];
  private lastBroadcast: number = 0;
  private readonly LATENCY_THRESHOLD = 100; // ms
  private readonly DEBOUNCE_MS = 50; // ms

  constructor(options: CRDTDocumentOptions) {
    this.docId = options.docId;
    this.userId = options.userId || 'anonymous';
    this.userName = options.userName || 'Anonymous';
    this.userColor = this.generateUserColor();

    // Initialize Automerge document
    const initialState = {
      content: options.initialContent || '',
      metadata: {
        createdBy: this.userId,
        createdAt: Date.now(),
        docId: this.docId,
      },
      users: {},
      versionVector: {},
      history: [],
    };

    this.doc = Automerge.from(initialState);
    this.versionVector[this.userId] = 1;

    console.log(`✓ CRDT Document initialized: ${this.docId}`);
  }

  /**
   * Get current document state
   */
  getState(): DocumentState {
    const content = this.getText();
    const collaborators = this.getCollaborators();

    return {
      id: this.docId,
      content,
      version: this.getCurrentVersion(),
      checksum: this.calculateChecksum(content),
      collaborators,
      lastModified: this.getLastModified(),
      lastModifiedBy: this.getLastModifiedBy(),
      isReadOnly: false,
    };
  }

  /**
   * Insert text at position
   */
  insertText(text: string, position: number): Operation {
    const timestamp = Date.now();
    const id = this.generateOperationId();

    // Apply locally
    this.doc = Automerge.change(this.doc, (d: any) => {
      const current = d.content || '';
      d.content = current.slice(0, position) + text + current.slice(position);
    });

    // Increment version
    this.versionVector[this.userId] = (this.versionVector[this.userId] || 0) + 1;

    const operation: Operation = {
      type: 'insert',
      position,
      content: text,
      userId: this.userId,
      timestamp,
      version: this.versionVector[this.userId],
      id,
    };

    this.localChanges.push(operation);
    this.notifyChange();

    return operation;
  }

  /**
   * Delete text at range
   */
  deleteText(position: number, length: number): Operation {
    const timestamp = Date.now();
    const id = this.generateOperationId();

    this.doc = Automerge.change(this.doc, (d: any) => {
      const current = d.content || '';
      d.content = current.slice(0, position) + current.slice(position + length);
    });

    this.versionVector[this.userId] = (this.versionVector[this.userId] || 0) + 1;

    const operation: Operation = {
      type: 'delete',
      position,
      length,
      userId: this.userId,
      timestamp,
      version: this.versionVector[this.userId],
      id,
    };

    this.localChanges.push(operation);
    this.notifyChange();

    return operation;
  }

  /**
   * Replace text at range
   */
  replaceText(position: number, length: number, text: string): Operation[] {
    const deleteOp = this.deleteText(position, length);
    const insertOp = this.insertText(text, position);
    return [deleteOp, insertOp];
  }

  /**
   * Apply remote operation (from another client)
   */
  applyOperation(operation: Operation): void {
    try {
      switch (operation.type) {
        case 'insert':
          this.applyInsert(operation);
          break;
        case 'delete':
          this.applyDelete(operation);
          break;
      }

      this.remoteChanges.push(operation);
      this.notifyChange();
    } catch (error) {
      console.error('Failed to apply operation:', error);
    }
  }

  private applyInsert(operation: Operation): void {
    this.doc = Automerge.change(this.doc, (d: any) => {
      const current = d.content || '';
      // Adjust position based on version vector
      const adjustedPos = this.adjustPositionByVector(operation.position);
      d.content =
        current.slice(0, adjustedPos) +
        (operation.content || '') +
        current.slice(adjustedPos);
    });
  }

  private applyDelete(operation: Operation): void {
    this.doc = Automerge.change(this.doc, (d: any) => {
      const current = d.content || '';
      const adjustedPos = this.adjustPositionByVector(operation.position);
      d.content =
        current.slice(0, adjustedPos) + current.slice(adjustedPos + (operation.length || 0));
    });
  }

  /**
   * Encode document to delta format for efficient transmission
   */
  encodeDelta(): DeltaOperation[] {
    const content = this.getText();
    const delta: DeltaOperation[] = [{ retain: content.length }];

    // This is a simplified delta encoding
    // In production, you'd use a more sophisticated diff algorithm
    return delta;
  }

  /**
   * Apply delta from remote
   */
  applyDelta(delta: DeltaOperation[]): void {
    delta.forEach((op) => {
      if (op.insert) {
        // Track changes
      }
    });
  }

  /**
   * Get collaborative state for sync
   */
  getSyncState(): { content: string; versionVector: VersionVector } {
    return {
      content: this.getText(),
      versionVector: { ...this.versionVector },
    };
  }

  /**
   * Merge remote state (for offline sync)
   */
  mergeState(remoteState: { content: string; versionVector: VersionVector }): boolean {
    try {
      // Use Automerge's merge capabilities
      const remoteDoc = Automerge.from({
        content: remoteState.content,
        metadata: { merged: true },
      });

      this.doc = Automerge.merge(this.doc, remoteDoc);

      // Merge version vectors
      Object.assign(this.versionVector, remoteState.versionVector);

      return true;
    } catch (error) {
      console.error('Merge failed:', error);
      return false;
    }
  }

  /**
   * Create snapshot for backup/restore
   */
  createSnapshot(): DocumentSnapshot {
    const content = this.getText();
    return {
      id: this.docId,
      content,
      version: this.getCurrentVersion(),
      vector: { ...this.versionVector },
      checksum: this.calculateChecksum(content),
      createdAt: Date.now(),
      createdBy: this.userId,
    };
  }

  /**
   * Restore from snapshot
   */
  restoreFromSnapshot(snapshot: DocumentSnapshot): void {
    this.doc = Automerge.from({
      content: snapshot.content,
      metadata: { restored: true },
    });
    this.versionVector = { ...snapshot.vector };
    console.log(`✓ Document restored from snapshot`);
  }

  /**
   * Register change callback
   */
  onChange(callback: (state: DocumentState) => void): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Unregister change callback
   */
  offChange(callback: (state: DocumentState) => void): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  /**
   * Get collaborator presence
   */
  getCollaborators(): UserPresence[] {
    const users = (this.doc.metadata?.users || {}) as Record<string, any>;
    return Object.values(users).map((user: any) => ({
      ...user,
      isActive: Date.now() - user.lastSeen < 30000, // Active if seen in last 30s
    }));
  }

  /**
   * Update local user presence
   */
  updatePresence(cursor: CursorPosition | null, selection: any = null): void {
    this.doc = Automerge.change(this.doc, (d: any) => {
      if (!d.metadata) d.metadata = {};
      if (!d.metadata.users) d.metadata.users = {};

      d.metadata.users[this.userId] = {
        id: this.userId,
        name: this.userName,
        color: this.userColor,
        cursor,
        selection,
        lastSeen: Date.now(),
      };
    });

    this.notifyChange();
  }

  /**
   * Get document text
   */
  getText(): string {
    return this.doc.content || '';
  }

  /**
   * Get document length
   */
  getLength(): number {
    return this.getText().length;
  }

  /**
   * Get current version number
   */
  getCurrentVersion(): number {
    return Object.values(this.versionVector).reduce((sum, v) => sum + v, 0);
  }

  /**
   * Get last modified timestamp
   */
  getLastModified(): number {
    return this.doc.metadata?.lastModified || Date.now();
  }

  /**
   * Get last modified by
   */
  getLastModifiedBy(): string {
    return this.doc.metadata?.lastModifiedBy || this.userId;
  }

  /**
   * Calculate content checksum (simplified)
   */
  private calculateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Adjust position based on version vector for OT
   */
  private adjustPositionByVector(position: number): number {
    // Simplified - in production you'd use a proper vector clock
    return position + this.countPendingInserts(position);
  }

  /**
   * Count pending inserts before position
   */
  private countPendingInserts(position: number): number {
    return this.localChanges.filter(
      (op) => op.position <= position && op.type === 'insert'
    ).length;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `${this.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate user color
   */
  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B595', '#F79D65', '#B8E986', '#6DC488',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Notify listeners of state change
   */
  private notifyChange(): void {
    this.lastBroadcast = Date.now();
    const state = this.getState();
    this.changeCallbacks.forEach((cb) => cb(state));
  }

  /**
   * Get document ID
   */
  getDocId(): string {
    return this.docId;
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get session history
   */
  getHistory(): Operation[] {
    return [...this.localChanges, ...this.remoteChanges].sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  /**
   * Export to JSON
   */
  toJSON(): string {
    return Automerge.save(this.doc);
  }

  /**
   * Import from JSON
   */
  fromJSON(json: string): void {
    this.doc = Automerge.load(json);
  }

  /**
   * Destroy document
   */
  destroy(): void {
    this.changeCallbacks = [];
    this.doc = null;
  }
}

// Factory function
export function createDocument(options: CRDTDocumentOptions): CRDTDocument {
  return new CRDTDocument(options);
}
