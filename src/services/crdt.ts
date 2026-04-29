import * as Automerge from 'automerge';

export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  color: string;
  cursor: { line: number; column: number } | null;
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
}

export interface CollaborativeDocument {
  id: string;
  content: string;
  version: number;
  lastModified: string;
  lastModifiedBy: string;
  users: CollaborationUser[];
  changes: Array<{
    userId: string;
    timestamp: string;
    operation: 'insert' | 'delete' | 'replace';
    position: number;
    value?: string;
    oldValue?: string;
  }>;
}

export class CRDTCollaborationManager {
  private doc: any = null;
  private docId: string = '';
  private userId: string = '';
  private userName: string = '';
  private userColor: string = '';
  private broadcastFn: ((event: any) => void) | null = null;
  private changeHistory: Map<string, any> = new Map();

  /**
   * Initialize collaboration context
   */
  initializeDocument(
    docId: string,
    userId: string,
    userName: string,
    initialContent: string = ''
  ): CollaborativeDocument {
    this.docId = docId;
    this.userId = userId;
    this.userName = userName;
    this.userColor = this.generateUserColor();

    // Create new Automerge document or load existing
    this.doc = Automerge.from({
      content: initialContent,
      users: {},
      metadata: {
        created: new Date().toISOString(),
        createdBy: userId,
      },
    });

    // Add current user
    this.addUser(userId, userName);

    console.log(`✓ CRDT document initialized: ${docId}`);

    return this.getDocumentState();
  }

  /**
   * Add user to collaboration session
   */
  addUser(userId: string, userName: string): CollaborationUser {
    const user: CollaborationUser = {
      id: userId,
      name: userName,
      email: `${userName}@void.dev`,
      color: this.generateUserColor(),
      cursor: null,
    };

    // Track user in document
    if (!this.doc.users) {
      this.doc = Automerge.change(this.doc, (d) => {
        d.users = {};
      });
    }

    this.doc = Automerge.change(this.doc, (d) => {
      d.users[userId] = user;
    });

    return user;
  }

  /**
   * Remove user from collaboration
   */
  removeUser(userId: string): void {
    this.doc = Automerge.change(this.doc, (d) => {
      delete d.users[userId];
    });

    console.log(`✓ User removed: ${userId}`);
  }

  /**
   * Insert text at position
   */
  insertText(text: string, position: number): void {
    this.doc = Automerge.change(this.doc, (d) => {
      const current = d.content || '';
      d.content = current.slice(0, position) + text + current.slice(position);
    });

    this.broadcastChange({
      type: 'insert',
      userId: this.userId,
      position,
      text,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Delete text at range
   */
  deleteText(position: number, length: number): void {
    this.doc = Automerge.change(this.doc, (d) => {
      const current = d.content || '';
      d.content = current.slice(0, position) + current.slice(position + length);
    });

    this.broadcastChange({
      type: 'delete',
      userId: this.userId,
      position,
      length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Replace text at range
   */
  replaceText(position: number, length: number, text: string): void {
    this.deleteText(position, length);
    this.insertText(text, position);

    this.broadcastChange({
      type: 'replace',
      userId: this.userId,
      position,
      oldLength: length,
      newText: text,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update user cursor position
   */
  updateCursor(line: number, column: number): void {
    this.doc = Automerge.change(this.doc, (d) => {
      if (!d.users[this.userId]) {
        d.users[this.userId] = {};
      }
      d.users[this.userId].cursor = { line, column };
    });

    this.broadcastChange({
      type: 'cursorUpdate',
      userId: this.userId,
      cursor: { line, column },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update user selection
   */
  updateSelection(startLine: number, startCol: number, endLine: number, endCol: number): void {
    this.doc = Automerge.change(this.doc, (d) => {
      if (!d.users[this.userId]) {
        d.users[this.userId] = {};
      }
      d.users[this.userId].selection = {
        start: { line: startLine, column: startCol },
        end: { line: endLine, column: endCol },
      };
    });

    this.broadcastChange({
      type: 'selectionUpdate',
      userId: this.userId,
      selection: {
        start: { line: startLine, column: startCol },
        end: { line: endLine, column: endCol },
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Apply remote changes from other users
   */
  applyRemoteChange(change: any): void {
    try {
      // Handle different change types
      switch (change.type) {
        case 'insert':
          this.doc = Automerge.change(this.doc, (d) => {
            const current = d.content || '';
            d.content = current.slice(0, change.position) + change.text + current.slice(change.position);
          });
          break;

        case 'delete':
          this.doc = Automerge.change(this.doc, (d) => {
            const current = d.content || '';
            d.content = current.slice(0, change.position) + current.slice(change.position + change.length);
          });
          break;

        case 'replace':
          this.doc = Automerge.change(this.doc, (d) => {
            const current = d.content || '';
            d.content =
              current.slice(0, change.position) +
              change.newText +
              current.slice(change.position + change.oldLength);
          });
          break;

        case 'cursorUpdate':
          this.doc = Automerge.change(this.doc, (d) => {
            if (d.users[change.userId]) {
              d.users[change.userId].cursor = change.cursor;
            }
          });
          break;

        case 'selectionUpdate':
          this.doc = Automerge.change(this.doc, (d) => {
            if (d.users[change.userId]) {
              d.users[change.userId].selection = change.selection;
            }
          });
          break;
      }

      // Track change in history
      this.changeHistory.set(`${Date.now()}-${Math.random()}`, change);
    } catch (error) {
      console.error('Failed to apply remote change:', error);
    }
  }

  /**
   * Merge two document versions (conflict resolution)
   */
  mergeDocuments(otherDoc: any): void {
    try {
      this.doc = Automerge.merge(this.doc, otherDoc);
      console.log('✓ Documents merged successfully');
    } catch (error) {
      console.error('Merge error:', error);
    }
  }

  /**
   * Get current document state
   */
  getDocumentState(): CollaborativeDocument {
    const users = Object.values((this.doc.users || {}) as Record<string, CollaborationUser>);

    return {
      id: this.docId,
      content: this.doc.content || '',
      version: Automerge.getHeads(this.doc).length,
      lastModified: new Date().toISOString(),
      lastModifiedBy: this.userId,
      users,
      changes: Array.from(this.changeHistory.values()).slice(-100), // Last 100 changes
    };
  }

  /**
   * Get change history between two versions
   */
  getChangeHistory(fromVersion?: number): any[] {
    return Array.from(this.changeHistory.values());
  }

  /**
   * Create a snapshot of current state (for backup)
   */
  createSnapshot(): string {
    return JSON.stringify(this.getDocumentState());
  }

  /**
   * Restore from snapshot
   */
  restoreFromSnapshot(snapshot: string): void {
    try {
      const state = JSON.parse(snapshot);
      this.doc = Automerge.from(state);
      console.log('✓ Document restored from snapshot');
    } catch (error) {
      console.error('Restore error:', error);
    }
  }

  /**
   * Register broadcast function for remote distribution
   */
  onBroadcast(fn: (event: any) => void): void {
    this.broadcastFn = fn;
  }

  /**
   * Broadcast change to all connected clients
   */
  private broadcastChange(change: any): void {
    if (this.broadcastFn) {
      this.broadcastFn({
        docId: this.docId,
        userId: this.userId,
        change,
      });
    }
  }

  /**
   * Get all active users
   */
  getActiveUsers(): CollaborationUser[] {
    return Object.values((this.doc.users || {}) as Record<string, CollaborationUser>).filter((u) => u.cursor);
  }

  /**
   * Get presence info (who's online, where they're typing)
   */
  getPresence(): Record<
    string,
    { user: CollaborationUser; isActive: boolean; lastUpdate: string }
  > {
    const presence: Record<
      string,
      { user: CollaborationUser; isActive: boolean; lastUpdate: string }
    > = {};

    for (const [userId, user] of Object.entries(this.doc.users || {})) {
      presence[userId] = {
        user: user as CollaborationUser,
        isActive: (user as CollaborationUser).cursor !== null,
        lastUpdate: new Date().toISOString(),
      };
    }

    return presence;
  }

  /**
   * Generate random user color
   */
  private generateUserColor(): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E2',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get document as plain text
   */
  getText(): string {
    return this.doc.content || '';
  }

  /**
   * Get conflict-free merged state
   */
  getConflictFreeState(): any {
    return Automerge.clone(this.doc);
  }
}

// Singleton instance
export const crdt = new CRDTCollaborationManager();
