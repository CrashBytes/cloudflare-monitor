/**
 * 📡 Server-Sent Events (SSE) Route
 * 
 * Establishes persistent HTTP connections for real-time deployment updates.
 * 
 * ## Connection Flow
 * 
 * 1. Client sends GET request to /api/events
 * 2. Server upgrades to SSE protocol (text/event-stream)
 * 3. Server sends periodic updates when deployments change
 * 4. Connection remains open until client disconnects or timeout
 * 
 * ## Message Format
 * 
 * All SSE messages follow this structure:
 * ```
 * event: deployment_update
 * data: {"id": "...", "status": "active", ...}
 * id: <timestamp>
 * ```
 * 
 * ## Event Types
 * 
 * - **connected**: Initial handshake confirmation
 * - **deployment_update**: Deployment status changed
 * - **project_update**: Project metadata changed
 * - **heartbeat**: Keep-alive ping every 30s
 * - **error**: Server-side error notification
 * 
 * ## Scaling Considerations
 * 
 * Current implementation:
 * - Single-server: Perfect for small/medium deployments
 * - In-memory client registry: Fast but not distributed
 * 
 * Future enhancements for scale:
 * - Redis-backed pub/sub for multi-instance deployments
 * - Sticky sessions for connection affinity
 * - WebSocket alternative for bidirectional needs
 */

import { Hono } from 'hono';
import { sseManager } from '../sse/manager';

export const eventsRouter = new Hono();

/**
 * GET /api/events
 * 
 * Establish SSE connection with optional topic filtering.
 * 
 * Query Parameters:
 * - topics: Comma-separated list of topics (default: '*' for all)
 * 
 * Example:
 * GET /api/events?topics=deployments,projects
 */
eventsRouter.get('/', async (c) => {
  try {
    // Parse topics from query string
    const topicsParam = c.req.query('topics') || '*';
    const topics = topicsParam === '*' ? ['*'] : topicsParam.split(',').map(t => t.trim());

    console.log(`[SSE] New connection request with topics: ${topics.join(', ')}`);

    // Create SSE connection using manager
    const response = await sseManager.createConnection(c, topics);
    
    return response;
  } catch (error) {
    console.error('[SSE] Error creating connection:', error);
    return c.json({
      success: false,
      error: {
        code: 'CONNECTION_FAILED',
        message: 'Failed to establish SSE connection',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
    }, 500);
  }
});

/**
 * GET /api/events/stats
 * 
 * Retrieve SSE connection statistics.
 * Useful for monitoring and debugging.
 */
eventsRouter.get('/stats', (c) => {
  const stats = sseManager.getStats();
  
  return c.json({
    success: true,
    data: stats,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/events/broadcast
 * 
 * Manual broadcast endpoint for testing.
 * Should be protected in production or removed.
 */
eventsRouter.post('/broadcast', async (c) => {
  try {
    const body = await c.req.json();
    const { topic, event, data } = body;

    if (!topic || !event || !data) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: topic, event, data',
        },
      }, 400);
    }

    await sseManager.broadcast(topic, {
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      success: true,
      meta: {
        timestamp: new Date().toISOString(),
        message: 'Broadcast sent successfully',
      },
    });
  } catch (error) {
    console.error('[SSE] Broadcast error:', error);
    return c.json({
      success: false,
      error: {
        code: 'BROADCAST_FAILED',
        message: 'Failed to broadcast message',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
    }, 500);
  }
});
