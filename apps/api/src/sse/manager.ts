/**
 * 📡 Server-Sent Events (SSE) Manager
 * 
 * Implements real-time push notifications to connected clients using the SSE protocol.
 * 
 * ## Why SSE Over WebSockets?
 * 
 * **SSE Advantages:**
 * - Simpler protocol (HTTP-based)
 * - Automatic reconnection built into browser API
 * - Better integration with HTTP/2 multiplexing
 * - No need for bidirectional communication in our use case
 * 
 * **Trade-offs:**
 * - Unidirectional (server → client only)
 * - Text-only payload (acceptable for JSON)
 * - No native binary support
 * 
 * ## Architecture
 * 
 * Uses a **pub/sub pattern** with:
 * - Centralized connection registry
 * - Topic-based message routing
 * - Automatic client cleanup on disconnect
 * 
 * ## Connection Lifecycle
 * 
 * 1. Client initiates SSE connection
 * 2. Server registers client in active connections
 * 3. Server broadcasts updates to all registered clients
 * 4. Connection auto-closes on timeout or explicit disconnect
 * 5. Garbage collection removes stale connections
 * 
 * ## Memory Management
 * 
 * Implements defensive patterns to prevent memory leaks:
 * - Bounded connection pool
 * - Heartbeat mechanism for liveness detection
 * - Automatic cleanup of failed writes
 */

import type { Context } from 'hono';
import type { SSEMessage } from '@cloudflare-monitor/shared';

export interface SSEClient {
  id: string;
  context: Context;
  controller: ReadableStreamDefaultController;
  topics: Set<string>;
  connectedAt: number;
  lastHeartbeat: number;
}

export class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly MAX_CLIENTS = 1000; // Circuit breaker for DoS protection

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Register new SSE client connection
   * 
   * Establishes a persistent HTTP connection with appropriate headers:
   * - Content-Type: text/event-stream
   * - Cache-Control: no-cache
   * - Connection: keep-alive
   * 
   * @param c Hono context object
   * @param topics Optional topic subscriptions
   * @returns ReadableStream for SSE protocol
   */
  async createConnection(c: Context, topics: string[] = ['*']): Promise<Response> {
    // Rate limit protection
    if (this.clients.size >= this.MAX_CLIENTS) {
      return c.json({ error: 'Maximum client connections reached' }, 503);
    }

    const clientId = crypto.randomUUID();
    const topicSet = new Set(topics);

    return c.stream(async (stream) => {
      // Register client
      const client: SSEClient = {
        id: clientId,
        context: c,
        controller: stream as unknown as ReadableStreamDefaultController,
        topics: topicSet,
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      this.clients.set(clientId, client);

      console.log(`[SSE] Client connected: ${clientId} (topics: ${Array.from(topicSet).join(', ')})`);
      console.log(`[SSE] Active connections: ${this.clients.size}`);

      // Send initial connection confirmation
      await this.sendToClient(client, {
        event: 'connected',
        data: { clientId, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });

      // Keep connection alive until client disconnects
      await stream.wait();
    }, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  }

  /**
   * Broadcast message to all clients subscribed to a topic
   * 
   * Implements fire-and-forget semantics:
   * - Failed sends don't block other clients
   * - Dead connections are automatically cleaned up
   * 
   * @param topic Message topic (or '*' for broadcast)
   * @param message SSE message payload
   */
  async broadcast<T>(topic: string, message: SSEMessage<T>): Promise<void> {
    const targetClients = Array.from(this.clients.values()).filter(
      client => client.topics.has('*') || client.topics.has(topic)
    );

    if (targetClients.length === 0) {
      return; // No subscribers, skip broadcast
    }

    console.log(`[SSE] Broadcasting to ${targetClients.length} clients on topic: ${topic}`);

    const sendPromises = targetClients.map(client => 
      this.sendToClient(client, message)
        .catch(error => {
          console.error(`[SSE] Failed to send to client ${client.id}:`, error);
          this.removeClient(client.id);
        })
    );

    await Promise.allSettled(sendPromises);
  }

  /**
   * Send message to specific client
   * 
   * Formats message according to SSE protocol:
   * - event: <event_name>
   * - data: <json_payload>
   * - id: <message_id>
   * 
   * @param client Target client
   * @param message Message to send
   */
  private async sendToClient<T>(client: SSEClient, message: SSEMessage<T>): Promise<void> {
    try {
      const sseData = [
        `event: ${message.event}`,
        `data: ${JSON.stringify(message.data)}`,
        `id: ${Date.now()}`,
        '\n', // Required double newline to terminate message
      ].join('\n');

      // Bun's stream.write is synchronous, but we wrap for consistency
      await client.controller.write(sseData);
      
      client.lastHeartbeat = Date.now();
    } catch (error) {
      console.error(`[SSE] Send failed for client ${client.id}:`, error);
      throw error; // Propagate to trigger cleanup
    }
  }

  /**
   * Remove client connection
   * 
   * Gracefully closes stream and removes from registry.
   * Idempotent - safe to call multiple times.
   * 
   * @param clientId Client identifier
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.controller.close();
    } catch (error) {
      // Stream may already be closed, ignore error
    }

    this.clients.delete(clientId);
    console.log(`[SSE] Client disconnected: ${clientId}`);
    console.log(`[SSE] Active connections: ${this.clients.size}`);
  }

  /**
   * Start heartbeat mechanism
   * 
   * Periodically sends keep-alive messages to:
   * - Detect dead connections
   * - Prevent proxy timeouts
   * - Clean up stale clients
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = this.HEARTBEAT_INTERVAL * 2; // 60 seconds

      // Send heartbeat to all clients
      this.broadcast('heartbeat', {
        event: 'heartbeat',
        data: { timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });

      // Remove stale connections
      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastHeartbeat > staleThreshold) {
          console.log(`[SSE] Removing stale client: ${clientId}`);
          this.removeClient(clientId);
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat mechanism
   * 
   * Called during graceful shutdown to cleanup resources.
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all active connections
    for (const clientId of this.clients.keys()) {
      this.removeClient(clientId);
    }

    console.log('[SSE] Manager stopped');
  }

  /**
   * Get connection statistics
   * 
   * Useful for monitoring and debugging:
   * - Connection count
   * - Topic distribution
   * - Connection age metrics
   */
  getStats() {
    const now = Date.now();
    const connections = Array.from(this.clients.values());

    return {
      totalConnections: this.clients.size,
      maxConnections: this.MAX_CLIENTS,
      topicDistribution: this.getTopicDistribution(),
      averageConnectionAge: connections.length > 0
        ? Math.floor(connections.reduce((sum, c) => sum + (now - c.connectedAt), 0) / connections.length / 1000)
        : 0,
      oldestConnection: connections.length > 0
        ? Math.floor((now - Math.min(...connections.map(c => c.connectedAt))) / 1000)
        : 0,
    };
  }

  /**
   * Get topic subscription distribution
   */
  private getTopicDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const client of this.clients.values()) {
      for (const topic of client.topics) {
        distribution[topic] = (distribution[topic] || 0) + 1;
      }
    }

    return distribution;
  }

  /**
   * Health check for SSE service
   */
  getHealthStatus(): 'operational' | 'degraded' | 'down' {
    // Service is degraded if approaching connection limit
    const utilizationPercent = (this.clients.size / this.MAX_CLIENTS) * 100;

    if (utilizationPercent > 90) return 'degraded';
    if (this.heartbeatInterval === null) return 'down';
    return 'operational';
  }
}

// Global singleton instance
export const sseManager = new SSEManager();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SSE] Received SIGINT, closing connections...');
  sseManager.stop();
});

process.on('SIGTERM', () => {
  console.log('\n[SSE] Received SIGTERM, closing connections...');
  sseManager.stop();
});
