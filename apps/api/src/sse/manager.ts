/**
 * 📡 Server-Sent Events (SSE) Manager
 * 
 * Implements real-time push notifications to connected clients using the SSE protocol.
 * Uses EventEmitter pattern for decoupled message delivery.
 */

import { EventEmitter } from 'events';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { SSEMessage } from '@cloudflare-monitor/shared';

interface ClientInfo {
  id: string;
  topics: Set<string>;
  connectedAt: number;
}

class SSEEventEmitter extends EventEmitter {
  private readonly MAX_LISTENERS = 1000;
  
  constructor() {
    super();
    this.setMaxListeners(this.MAX_LISTENERS);
  }
}

export class SSEManager {
  private emitter: SSEEventEmitter;
  private clients: Map<string, ClientInfo> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.emitter = new SSEEventEmitter();
    this.startHeartbeat();
  }

  /**
   * Create SSE connection using Hono's streamSSE helper
   */
  async createConnection(c: Context, topics: string[] = ['*']): Promise<Response> {
    const clientId = crypto.randomUUID();
    const topicSet = new Set(topics);

    // Register client info
    this.clients.set(clientId, {
      id: clientId,
      topics: topicSet,
      connectedAt: Date.now(),
    });

    console.log(`[SSE] Client connected: ${clientId} (topics: ${Array.from(topicSet).join(', ')})`);
    console.log(`[SSE] Active connections: ${this.clients.size}`);

    return streamSSE(c, async (stream) => {
      // Send initial connection event
      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({ clientId, timestamp: new Date().toISOString() }),
        id: String(Date.now()),
      });

      // Message handler for this client
      const messageHandler = async (message: { topic: string; payload: SSEMessage<unknown> }) => {
        const clientInfo = this.clients.get(clientId);
        if (!clientInfo) return;

        // Check if client is subscribed to this topic
        if (!clientInfo.topics.has('*') && !clientInfo.topics.has(message.topic)) {
          return;
        }

        try {
          await stream.writeSSE({
            event: message.payload.event,
            data: JSON.stringify(message.payload.data),
            id: String(Date.now()),
          });
        } catch (error) {
          console.error(`[SSE] Failed to write to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      };

      // Subscribe to messages
      this.emitter.on('message', messageHandler);

      // Keep connection alive
      try {
        // Use an AbortController to detect disconnection
        const abortController = new AbortController();
        
        // Periodic check to keep stream alive
        while (this.clients.has(clientId)) {
          await stream.sleep(1000);
        }
      } catch (error) {
        // Connection closed
        console.log(`[SSE] Client stream ended: ${clientId}`);
      } finally {
        // Cleanup
        this.emitter.off('message', messageHandler);
        this.removeClient(clientId);
      }
    });
  }

  /**
   * Broadcast message to all subscribed clients
   */
  async broadcast<T>(topic: string, message: SSEMessage<T>): Promise<void> {
    const subscribedClients = Array.from(this.clients.values()).filter(
      client => client.topics.has('*') || client.topics.has(topic)
    );

    if (subscribedClients.length === 0) {
      return;
    }

    console.log(`[SSE] Broadcasting "${message.event}" to ${subscribedClients.length} clients on topic: ${topic}`);

    // Emit message for all handlers
    this.emitter.emit('message', { topic, payload: message });
  }

  /**
   * Remove client from registry
   */
  removeClient(clientId: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      console.log(`[SSE] Client disconnected: ${clientId}`);
      console.log(`[SSE] Active connections: ${this.clients.size}`);
    }
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast('heartbeat', {
        event: 'heartbeat',
        data: { timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop manager and close all connections
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear all clients
    this.clients.clear();
    this.emitter.removeAllListeners();

    console.log('[SSE] Manager stopped');
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const now = Date.now();
    const connections = Array.from(this.clients.values());

    return {
      totalConnections: this.clients.size,
      topicDistribution: this.getTopicDistribution(),
      averageConnectionAge: connections.length > 0
        ? Math.floor(connections.reduce((sum, c) => sum + (now - c.connectedAt), 0) / connections.length / 1000)
        : 0,
    };
  }

  private getTopicDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const client of this.clients.values()) {
      for (const topic of client.topics) {
        distribution[topic] = (distribution[topic] || 0) + 1;
      }
    }
    return distribution;
  }

  getHealthStatus(): 'operational' | 'degraded' | 'down' {
    if (this.heartbeatInterval === null) return 'down';
    return 'operational';
  }
}

// Global singleton instance
export const sseManager = new SSEManager();

process.on('SIGINT', () => {
  sseManager.stop();
});

process.on('SIGTERM', () => {
  sseManager.stop();
});
