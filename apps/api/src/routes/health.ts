/**
 * 🏥 Health Check Route
 * 
 * Provides system health and operational metrics for:
 * - Load balancer health checks
 * - Monitoring system integration
 * - Operational debugging
 * 
 * ## Health Check Strategy
 * 
 * Implements a **comprehensive health model** that checks:
 * 1. Process uptime (service availability)
 * 2. Database connectivity (data layer health)
 * 3. Cloudflare API reachability (external dependency)
 * 4. Polling service status (background job health)
 * 
 * ## Status Levels
 * 
 * - **healthy**: All systems operational
 * - **degraded**: Service running but with issues (e.g., high error rate)
 * - **unhealthy**: Critical failure, service should be removed from rotation
 */

import { Hono } from 'hono';
import { DatabaseManager } from '../db';
import { CloudflarePollingService } from '../services/cloudflare/polling';
import { sseManager } from '../sse/manager';
import { deploymentsCache, projectsCache, metricsCache } from '../services/cache';
import type { HealthStatus } from '@cloudflare-monitor/shared';

export const healthRouter = new Hono();

const startTime = Date.now();

/**
 * GET /health
 * 
 * Returns aggregated health status across all subsystems.
 * Suitable for automated health checks and dashboards.
 */
healthRouter.get('/', async (c) => {
  const dbHealth = DatabaseManager.healthCheck();
  const pollingService = c.get('pollingService') as CloudflarePollingService;
  const lastPoll = pollingService.getLastPollResult();

  // Determine Cloudflare API status from last poll
  const cloudflareApiStatus = lastPoll
    ? lastPoll.success
      ? 'operational'
      : lastPoll.errors.some(e => e.includes('authentication'))
        ? 'down'
        : 'degraded'
    : 'operational';

  // Polling service status
  const pollingStatus = pollingService.getStatus().isPolling
    ? lastPoll?.success
      ? 'operational'
      : 'degraded'
    : 'down';

  // Aggregate status determination
  const determineOverallStatus = (): HealthStatus['status'] => {
    if (dbHealth.status === 'down' || pollingStatus === 'down') {
      return 'unhealthy';
    }
    if (dbHealth.status === 'degraded' || pollingStatus === 'degraded' || cloudflareApiStatus === 'degraded') {
      return 'degraded';
    }
    return 'healthy';
  };

  const status: HealthStatus = {
    status: determineOverallStatus(),
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services: {
      database: dbHealth.status,
      cloudflare_api: cloudflareApiStatus,
      polling: pollingStatus,
    },
  };

  const httpStatus = status.status === 'unhealthy' ? 503 : 200;
  return c.json(status, httpStatus);
});

/**
 * GET /health/detailed
 * 
 * Returns comprehensive diagnostic information.
 * Includes metrics, cache statistics, and connection details.
 */
healthRouter.get('/detailed', async (c) => {
  const dbHealth = DatabaseManager.healthCheck();
  const dbStats = DatabaseManager.getStats();
  const pollingService = c.get('pollingService') as CloudflarePollingService;
  const pollingStatus = pollingService.getStatus();
  const sseStats = sseManager.getStats();

  const response = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services: {
      database: {
        status: dbHealth.status,
        details: dbStats,
      },
      polling: {
        status: pollingStatus.isPolling ? 'operational' : 'down',
        lastPoll: pollingStatus.lastPoll,
      },
      sse: {
        status: sseManager.getHealthStatus(),
        connections: sseStats,
      },
      cache: {
        deployments: deploymentsCache.getStats(),
        projects: projectsCache.getStats(),
        metrics: metricsCache.getStats(),
      },
    },
    process: {
      pid: process.pid,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
    },
  };

  return c.json(response);
});

/**
 * GET /health/ready
 * 
 * Kubernetes-style readiness probe.
 * Returns 200 when service is ready to accept traffic.
 */
healthRouter.get('/ready', (c) => {
  const pollingService = c.get('pollingService') as CloudflarePollingService;
  const isReady = pollingService.getStatus().isPolling;

  return isReady
    ? c.json({ ready: true })
    : c.json({ ready: false, reason: 'Polling service not started' }, 503);
});

/**
 * GET /health/live
 * 
 * Kubernetes-style liveness probe.
 * Returns 200 as long as process is running.
 */
healthRouter.get('/live', (c) => {
  return c.json({ alive: true });
});
