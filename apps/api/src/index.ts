import 'dotenv/config';
/**
 * 🎯 API Server Entry Point
 * 
 * Orchestrates the complete backend stack with production-grade patterns:
 * - Hono framework for high-performance HTTP handling
 * - CORS middleware for secure cross-origin requests
 * - Request logging for observability
 * - Graceful shutdown handling
 * - Service lifecycle management
 * 
 * ## Application Architecture
 * 
 * ```
 * HTTP Request → CORS → Logger → Router → Handler → Response
 *                                           ↓
 *                                      SSE Manager
 *                                           ↓
 *                                    Polling Service
 *                                           ↓
 *                                       Database
 * ```
 * 
 * ## Startup Sequence
 * 
 * 1. Load and validate configuration
 * 2. Initialize database connection
 * 3. Start polling service
 * 4. Mount API routes
 * 5. Begin accepting HTTP connections
 * 
 * ## Shutdown Sequence
 * 
 * 1. Stop accepting new connections
 * 2. Drain existing requests (graceful timeout)
 * 3. Stop polling service
 * 4. Close SSE connections
 * 5. Close database connection
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config';
import { db, DatabaseManager } from './db';
import { CloudflarePollingService } from './services/cloudflare/polling';
import { sseManager } from './sse/manager';

// Route imports
import { healthRouter } from './routes/health';
import { projectsRouter } from './routes/projects';
import { deploymentsRouter } from './routes/deployments';
import { eventsRouter } from './routes/events';

/**
 * Initialize Hono application with middleware stack
 */
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: config.CORS_ORIGIN,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
}));

/**
 * Inject polling service into context for route handlers
 * 
 * This middleware pattern enables:
 * - Centralized service instantiation
 * - Easy testing through dependency injection
 * - Type-safe context access
 */
const pollingService = new CloudflarePollingService();

app.use('*', async (c, next) => {
  c.set('pollingService', pollingService);
  await next();
});

/**
 * Mount API routes
 * 
 * Routes are organized by domain for clarity:
 * - /health: System health and diagnostics
 * - /api/projects: Project management
 * - /api/deployments: Deployment monitoring
 * - /api/events: Real-time SSE connections
 */
app.route('/health', healthRouter);
app.route('/api/projects', projectsRouter);
app.route('/api/deployments', deploymentsRouter);
app.route('/api/events', eventsRouter);

/**
 * Root endpoint - API metadata
 */
app.get('/', (c) => {
  return c.json({
    name: 'Cloudflare Monitor API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      projects: '/api/projects',
      deployments: '/api/deployments',
      events: '/api/events',
    },
    documentation: 'https://github.com/CrashBytes/cloudflare-monitor#api-documentation',
  });
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${c.req.path} not found`,
    },
  }, 404);
});

/**
 * Global error handler
 * 
 * Catches unhandled exceptions and formats consistent error responses.
 */
app.onError((err, c) => {
  console.error('[API] Unhandled error:', err);
  
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: config.NODE_ENV === 'development' ? { 
        error: err.message,
        stack: err.stack 
      } : undefined,
    },
  }, 500);
});

/**
 * Start the server and initialize services
 */
async function startServer() {
  try {
    console.log('🚀 Cloudflare Monitor API Starting...\n');

    // Verify database connection
    console.log('[Database] Verifying connection...');
    const dbHealth = DatabaseManager.healthCheck();
    if (dbHealth.status === 'down') {
      throw new Error('Database connection failed');
    }
    console.log('[Database] ✓ Connected\n');

    // Start polling service
    console.log('[Polling] Starting service...');
    pollingService.start();
    console.log('[Polling] ✓ Active\n');

    // Start HTTP server
    const server = Bun.serve({
      port: config.API_PORT,
      hostname: config.API_HOST,
      fetch: app.fetch,
    });

    console.log('✨ Server ready!\n');
    console.log(`📍 Listening on http://${server.hostname}:${server.port}`);
    console.log(`🌍 Environment: ${config.NODE_ENV}`);
    console.log(`⏱️  Poll interval: ${config.POLL_INTERVAL_MS}ms`);
    console.log(`📊 Database: ${config.DATABASE_PATH}\n`);
    console.log('Available endpoints:');
    console.log(`  - Health: http://${server.hostname}:${server.port}/health`);
    console.log(`  - Projects: http://${server.hostname}:${server.port}/api/projects`);
    console.log(`  - Deployments: http://${server.hostname}:${server.port}/api/deployments`);
    console.log(`  - Events (SSE): http://${server.hostname}:${server.port}/api/events`);
    console.log('\n✅ Monitoring Cloudflare deployments in real-time\n');

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        console.log('[Server] Closing HTTP server...');
        server.stop();

        // Stop polling
        console.log('[Polling] Stopping service...');
        pollingService.stop();

        // Close SSE connections
        console.log('[SSE] Closing connections...');
        sseManager.stop();

        // Close database
        console.log('[Database] Closing connection...');
        DatabaseManager.close();

        console.log('[Server] ✓ Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('[Server] Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      console.error('[Server] Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
