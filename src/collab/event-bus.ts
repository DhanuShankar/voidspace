/**
 * Event Bus for Collaboration System
 * Centralized event handling with pub/sub pattern
 */

import { EventEmitter } from 'events';
import { CollabEvent, CollabEventType } from '../types/collab.types';
import { WebSocketServer } from './socket';

export interface EventSubscription {
  id: string;
  eventType: CollabEventType | 'all';
  handler: (event: CollabEvent) => void;
  createdAt: number;
}

export interface EventMetrics {
  eventsProcessed: number;
  avgProcessingTime: number;
  errors: number;
}

export class EventBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private metrics: EventMetrics;
  private wsServer?: WebSocketServer;
  private messageQueue: CollabEvent[] = [];
  private isProcessing = false;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly BATCH_SIZE = 50;

  constructor() {
    this.emitter = new EventEmitter();
    this.metrics = {
      eventsProcessed: 0,
      avgProcessingTime: 0,
      errors: 0,
    };
  }

  /**
   * Register WebSocket server for event propagation
   */
  registerWebSocketServer(server: WebSocketServer): void {
    this.wsServer = server;
  }

  /**
   * Subscribe to events
   */
  on(eventType: CollabEventType | 'all', handler: (event: CollabEvent) => void): string {
    const id = this.generateSubscriptionId();
    const subscription: EventSubscription = {
      id,
      eventType,
      handler,
      createdAt: Date.now(),
    };

    this.subscriptions.set(id, subscription);

    // Wire up to EventEmitter
    this.emitter.on(eventType, handler);

    return id;
  }

  /**
   * Unsubscribe from events
   */
  off(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    this.emitter.off(subscription.eventType, subscription.handler);
    this.subscriptions.delete(subscriptionId);

    return true;
  }

  /**
   * Emit event
   */
  emitEvent(event: CollabEvent): void {
    // Queue event for processing
    this.messageQueue.push(event);

    // Process batch if queue is full
    if (this.messageQueue.length >= this.BATCH_SIZE) {
      this.processBatch();
    }
  }

  /**
   * Emit event with immediate processing
   */
  async emitEventSync(event: CollabEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Process locally
      if (event.type !== 'all') {
        this.emitter.emit(event.type, event);
      }
      this.emitter.emit('all', event);

      // Forward to WebSocket server if available
      if (this.wsServer) {
        this.broadcastToRoom(event.roomId, event.type, event.data);
      }

      // Update metrics
      this.updateMetrics(Date.now() - startTime, false);
    } catch (error) {
      this.metrics.errors++;
      console.error('Event processing error:', error);
    }
  }

  /**
   * Process queued events in batch
   */
  private processBatch(): void {
    if (this.isProcessing || this.messageQueue.length === 0) return;

    this.isProcessing = true;
    const batch = this.messageQueue.splice(0, this.BATCH_SIZE);

    const startTime = Date.now();

    try {
      batch.forEach((event) => {
        if (event.type !== 'all') {
          this.emitter.emit(event.type, event);
        }
        this.emitter.emit('all', event);
      });

      // Forward to WebSocket
      if (this.wsServer) {
        batch.forEach((event) => {
          this.broadcastToRoom(event.roomId, event.type, event.data);
        });
      }

      this.updateMetrics(Date.now() - startTime, false);
    } catch (error) {
      this.metrics.errors++;
      console.error('Batch event processing error:', error);
    } finally {
      this.isProcessing = false;

      // Process remaining queue
      if (this.messageQueue.length > 0) {
        setTimeout(() => this.processBatch(), 0);
      }
    }
  }

  /**
   * Broadcast to room via WebSocket
   */
  private broadcastToRoom(roomId: string, eventType: CollabEventType, data: any): void {
    if (!this.wsServer) return;

    const payload = {
      type: eventType,
      roomId,
      timestamp: Date.now(),
      data,
    };

    // Use optimized broadcast
    this.wsServer.getIO().to(roomId).emit('event', payload);
  }

  /**
   * Update metrics
   */
  private updateMetrics(processingTime: number, isError: boolean): void {
    this.metrics.eventsProcessed++;

    // Rolling average
    const total = this.metrics.eventsProcessed;
    this.metrics.avgProcessingTime =
      (this.metrics.avgProcessingTime * (total - 1) + processingTime) / total;

    if (isError) {
      this.metrics.errors++;
    }
  }

  /**
   * Generate subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all subscriptions
   */
  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Flush pending events
   */
  async flush(): Promise<void> {
    while (this.messageQueue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.forEach((_, id) => this.off(id));
    this.messageQueue = [];
    this.metrics = { eventsProcessed: 0, avgProcessingTime: 0, errors: 0 };
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    this.clear();
    this.emitter.removeAllListeners();
  }
}

// Singleton instance
export const eventBus = new EventBus();

/**
 * Event filter utility
 */
export function filterEventsByType(
  events: CollabEvent[],
  types: CollabEventType[]
): CollabEvent[] {
  return events.filter((event) => types.includes(event.type));
}

/**
 * Event throttler
 */
export function throttleEvents(
  handler: (event: CollabEvent) => void,
  interval: number = 100
): (event: CollabEvent) => void {
  let lastCall = 0;
  return (event: CollabEvent) => {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      handler(event);
    }
  };
}
