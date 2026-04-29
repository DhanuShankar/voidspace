/**
 * Operational Transformation Engine
 * Handles concurrent edit conflicts using position-based transformation
 */

import { Operation, DeltaOperation, VersionVector } from '../types/collab.types';

export interface TransformationResult {
  transformedOperations: Operation[];
  needsRebase: boolean;
  conflictDetected: boolean;
}

export interface OTContext {
  versionVector: VersionVector;
  siteId: string;
  clientId: string;
}

export class OperationalTransformer {
  private siteId: string;
  private history: Map<string, Operation[]> = new Map();
  private queue: Operation[] = [];
  private processing = false;

  constructor(siteId?: string) {
    this.siteId = siteId || this.generateSiteId();
  }

  /**
   * Transform two concurrent operations
   */
  transform(op1: Operation, op2: Operation, priority: 'left' | 'right' = 'left'): [Operation, Operation] {
    // Same user - no transformation needed
    if (op1.userId === op2.userId) {
      return this.transformSameUser(op1, op2);
    }

    // Different operations affecting same position
    if (this.operationsConflict(op1, op2)) {
      return this.transformConflicting(op1, op2, priority);
    }

    // Non-conflicting operations
    return this.transformNonConflicting(op1, op2);
  }

  /**
   * Transform same-user operations (preserve order)
   */
  private transformSameUser(op1: Operation, op2: Operation): [Operation, Operation] {
    const ordered = op1.timestamp < op2.timestamp ? [op1, op2] : [op2, op1];
    return ordered as [Operation, Operation];
  }

  /**
   * Transform conflicting operations (same region)
   */
  private transformConflicting(
    op1: Operation,
    op2: Operation,
    priority: 'left' | 'right'
  ): [Operation, Operation] {
    const positionDiff = this.calculatePositionDifference(op1, op2);

    let transformedOp2: Operation;

    if (priority === 'left') {
      // op1 gets priority, transform op2
      transformedOp2 = this.transformOperation(op2, op1, 1);
    } else {
      // op2 gets priority, transform op1
      const newOp1 = this.transformOperation(op1, op2, -1);
      return [newOp1, op2];
    }

    return [op1, transformedOp2];
  }

  /**
   * Transform non-conflicting operations
   */
  private transformNonConflicting(
    op1: Operation,
    op2: Operation
  ): [Operation, Operation] {
    // Check if one operation affects area before other
    const end1 = op1.position + (op1.length || (op1.content?.length || 0));
    const end2 = op2.position + (op2.length || (op2.content?.length || 0));

    // No overlap
    if (end1 <= op2.position || end2 <= op1.position) {
      return [op1, op2];
    }

    // One completely contains the other
    if (op1.position <= op2.position && end1 >= end2) {
      return [op1, this.shiftOperation(op2, op1.length || 0)];
    }

    if (op2.position <= op1.position && end2 >= end1) {
      return [this.shiftOperation(op1, op2.length || 0), op2];
    }

    // Partial overlap - use position-based transformation
    return this.transformConflicting(op1, op2, 'left');
  }

  /**
   * Transform operation against another operation
   */
  private transformOperation(op: Operation, against: Operation, direction: number): Operation {
    if (against.type === 'insert') {
      return this.shiftOperation(op, against.content!.length * direction);
    }

    if (against.type === 'delete') {
      return this.shiftOperation(op, -against.length! * direction);
    }

    return op;
  }

  /**
   * Shift operation position
   */
  private shiftOperation(op: Operation, delta: number): Operation {
    return {
      ...op,
      position: Math.max(0, op.position + delta),
    };
  }

  /**
   * Calculate position difference between operations
   */
  private calculatePositionDifference(op1: Operation, op2: Operation): number {
    if (op1.position < op2.position) {
      return -(op2.position - op1.position);
    }
    return op1.position - op2.position;
  }

  /**
   * Check if two operations conflict
   */
  private operationsConflict(op1: Operation, op2: Operation): boolean {
    if (op1.userId === op2.userId) return false;

    const start1 = op1.position;
    const end1 = start1 + (op1.length || (op1.content?.length || 0));
    const start2 = op2.position;
    const end2 = start2 + (op2.length || (op2.content?.length || 0));

    return !(end1 <= start2 || end2 <= start1);
  }

  /**
   * Batch transform multiple operations
   */
  transformBatch(operations: Operation[]): Operation[][] {
    if (operations.length < 2) return [operations];

    const groups: Operation[][] = [];
    let currentGroup: Operation[] = [operations[0]];

    for (let i = 1; i < operations.length; i++) {
      const prevOp = operations[i - 1];
      const currentOp = operations[i];

      // Check if operations conflict (need transformation)
      if (
        this.operationsConflict(prevOp, currentOp) ||
        (prevOp.timestamp > currentOp.timestamp) // Out of order
      ) {
        groups.push(currentGroup);
        currentGroup = [currentOp];
      } else {
        currentGroup.push(currentOp);
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Queue operation for async processing
   */
  async queueOperation(op: Operation): Promise<Operation[]> {
    return new Promise((resolve) => {
      this.queue.push(op);
      if (!this.processing) {
        this.processQueue().then(resolve);
      } else {
        // Wait for processing
        setTimeout(() => resolve([op]), 50);
      }
    });
  }

  /**
   * Process operation queue
   */
  private async processQueue(): Promise<Operation[]> {
    this.processing = true;
    const batch = [...this.queue];
    this.queue = [];

    const transformed = this.transformBatch(batch).flat();

    this.processing = false;
    return transformed;
  }

  /**
   * Clear history for a document
   */
  clearHistory(docId: string): void {
    this.history.delete(docId);
  }

  /**
   * Generate unique site ID
   */
  private generateSiteId(): string {
    return `site-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get site ID
   */
  getSiteId(): string {
    return this.siteId;
  }

  /**
   * Snapshot state for debugging
   */
  snapshot(): { queueLength: number; processing: boolean } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }
}

// Singleton instance for each collaboration session
export const otEngine = new OperationalTransformer();

/**
 * Convert delta operations to CRDT operations
 */
export function deltaToOperations(delta: DeltaOperation[]): Operation[] {
  const operations: Operation[] = [];
  let position = 0;

  delta.forEach((op, index) => {
    if (op.retain) {
      position += op.retain;
    } else if (op.insert) {
      operations.push({
        type: 'insert',
        position,
        content: op.insert.content,
        userId: 'system',
        timestamp: Date.now(),
        version: index,
        id: `delta-${index}`,
      });
      position += op.insert.content.length;
    } else if (op.delete) {
      operations.push({
        type: 'delete',
        position,
        length: op.delete.length,
        userId: 'system',
        timestamp: Date.now(),
        version: index,
        id: `delta-${index}`,
      });
    }
  });

  return operations;
}

/**
 * Calculate diff between two text versions
 */
export function calculateTextDiff(oldText: string, newText: string): DeltaOperation[] {
  // Simplified diff - use a proper diff library in production
  const result: DeltaOperation[] = [];

  if (oldText === newText) {
    return result;
  }

  // For now, treat whole change as a replace
  result.push({
    retain: 0,
    insert: { index: 0, content: newText },
  });

  return result;
}
