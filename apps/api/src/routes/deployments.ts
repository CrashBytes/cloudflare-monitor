/**
 * 🚀 Deployments API Routes
 * 
 * Real-time deployment monitoring endpoints with advanced filtering capabilities.
 */

import { Hono } from 'hono';
import { db, DeploymentsRepository } from '../db';
import { deploymentsCache } from '../services/cache';
import { config } from '../config';
import type { APIResponse, CloudflareDeployment, DeploymentStatus } from '@cloudflare-monitor/shared';

export const deploymentsRouter = new Hono();

const deploymentsRepo = new DeploymentsRepository(db);

/**
 * GET /api/deployments
 * 
 * Retrieve all deployments with optional filtering.
 * 
 * Query Parameters:
 * - status: Filter by deployment status
 * - environment: Filter by production/preview
 * - days: Only show deployments from last N days (for failures)
 */
deploymentsRouter.get('/', async (c) => {
  try {
    const statusFilter = c.req.query('status') as DeploymentStatus | undefined;
    const envFilter = c.req.query('environment') as 'production' | 'preview' | undefined;
    const daysParam = c.req.query('days');
    const days = daysParam ? parseInt(daysParam) : undefined;
    
    const cacheKey = `deployments:${statusFilter || 'all'}:${envFilter || 'all'}:${days || 'all'}`;
    const cached = deploymentsCache.get(cacheKey);
    
    if (cached) {
      return c.json({
        success: true,
        data: cached,
        meta: {
          timestamp: new Date().toISOString(),
          cached: true,
        },
      } as APIResponse<CloudflareDeployment[]>);
    }

    // Fetch from database with filters
    let deployments: CloudflareDeployment[];
    
    if (statusFilter && days) {
      deployments = deploymentsRepo.findByStatusRecent(statusFilter, days);
    } else if (statusFilter) {
      deployments = deploymentsRepo.findByStatus(statusFilter);
    } else if (days) {
      deployments = deploymentsRepo.findRecent(days);
    } else {
      deployments = deploymentsRepo.findAll();
    }

    // Apply environment filter if specified
    if (envFilter) {
      deployments = deployments.filter(d => d.environment === envFilter);
    }

    // Cache filtered results
    deploymentsCache.set(cacheKey, deployments);

    return c.json({
      success: true,
      data: deployments,
      meta: {
        timestamp: new Date().toISOString(),
        total: deployments.length,
        filters: {
          status: statusFilter,
          environment: envFilter,
          days,
        },
      },
    } as APIResponse<CloudflareDeployment[]>);
  } catch (error) {
    console.error('[API] Error fetching deployments:', error);
    return c.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to retrieve deployments',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
    } as APIResponse<never>, 500);
  }
});

/**
 * GET /api/deployments/:id
 * 
 * Retrieve specific deployment by ID with full stage details.
 */
deploymentsRouter.get('/:id', async (c) => {
  try {
    const deploymentId = c.req.param('id');
    
    const cacheKey = `deployment:${deploymentId}`;
    const cached = deploymentsCache.get(cacheKey);
    
    if (cached) {
      return c.json({
        success: true,
        data: cached,
        meta: {
          timestamp: new Date().toISOString(),
          cached: true,
        },
      } as APIResponse<CloudflareDeployment>);
    }

    // Query database
    const allDeployments = deploymentsRepo.findAll();
    const deployment = allDeployments.find(d => d.id === deploymentId);

    if (!deployment) {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Deployment with ID ${deploymentId} not found`,
        },
      } as APIResponse<never>, 404);
    }

    deploymentsCache.set(cacheKey, deployment);

    return c.json({
      success: true,
      data: deployment,
      meta: {
        timestamp: new Date().toISOString(),
      },
    } as APIResponse<CloudflareDeployment>);
  } catch (error) {
    console.error('[API] Error fetching deployment:', error);
    return c.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to retrieve deployment',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
    } as APIResponse<never>, 500);
  }
});

/**
 * GET /api/deployments/active/latest
 * 
 * Get the most recent active deployments across all projects.
 * Optimized query for dashboard views.
 */
deploymentsRouter.get('/active/latest', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '25');
    
    const cacheKey = `deployments:active:latest:${limit}`;
    const cached = deploymentsCache.get(cacheKey);
    
    if (cached) {
      return c.json({
        success: true,
        data: cached,
        meta: {
          timestamp: new Date().toISOString(),
          cached: true,
        },
      });
    }

    const activeDeployments = deploymentsRepo.findByStatus('active');
    
    // Sort by modified date and take limit
    const latest = activeDeployments
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      .slice(0, limit);

    deploymentsCache.set(cacheKey, latest);

    return c.json({
      success: true,
      data: latest,
      meta: {
        timestamp: new Date().toISOString(),
        total: latest.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching active deployments:', error);
    return c.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to retrieve active deployments',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
    } as APIResponse<never>, 500);
  }
});

/**
 * GET /api/deployments/stats/summary
 * 
 * Aggregate deployment statistics by status.
 * 
 * Note: Failure count uses FAILURE_RETENTION_DAYS to avoid showing stale failures.
 * All-time failure count is available as failureTotal.
 */
deploymentsRouter.get('/stats/summary', async (c) => {
  try {
    const cacheKey = 'deployments:stats';
    const cached = deploymentsCache.get(cacheKey);
    
    if (cached) {
      return c.json({
        success: true,
        data: cached,
        meta: { timestamp: new Date().toISOString(), cached: true },
      });
    }

    const retentionDays = config.FAILURE_RETENTION_DAYS;

    const stats = {
      total: deploymentsRepo.count(),
      active: deploymentsRepo.countByStatus('active'),
      building: deploymentsRepo.countByStatus('building'),
      deploying: deploymentsRepo.countByStatus('deploying'),
      // Only count recent failures (within retention window)
      failure: deploymentsRepo.countByStatusRecent('failure', retentionDays),
      // Total failures for reference
      failureTotal: deploymentsRepo.countByStatus('failure'),
      queued: deploymentsRepo.countByStatus('queued'),
      cancelled: deploymentsRepo.countByStatus('cancelled'),
      // Include retention window for UI display
      failureRetentionDays: retentionDays,
    };

    deploymentsCache.set(cacheKey, stats);

    return c.json({
      success: true,
      data: stats,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Error fetching deployment stats:', error);
    return c.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: 'Failed to retrieve deployment statistics',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      },
    } as APIResponse<never>, 500);
  }
});
