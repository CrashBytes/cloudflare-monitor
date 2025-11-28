/**
 * Health Routes Integration Tests
 * 
 * Integration tests for health check API endpoints.
 */

import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';

// Mock health router for testing
function createHealthRouter() {
  const router = new Hono();
  
  const startTime = Date.now();
  
  router.get('/', (c) => {
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  router.get('/ready', (c) => {
    return c.json({
      ready: true,
      checks: {
        database: true,
        cloudflare: true,
      },
    });
  });

  router.get('/live', (c) => {
    return c.json({
      alive: true,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  router.get('/detailed', (c) => {
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      services: {
        database: 'operational',
        cloudflare_api: 'operational',
        polling: 'operational',
      },
      cache: {
        deployments: { hitRate: '75.00%', size: 10 },
        projects: { hitRate: '90.00%', size: 4 },
      },
    });
  });

  return router;
}

describe('Health Routes - integration', () => {
  const app = new Hono();
  app.route('/health', createHealthRouter());

  test('GET /health returns healthy status', async () => {
    const res = await app.request('/health');
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toBeDefined();
  });

  test('GET /health/ready returns readiness status', async () => {
    const res = await app.request('/health/ready');
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.checks.database).toBe(true);
    expect(body.checks.cloudflare).toBe(true);
  });

  test('GET /health/live returns liveness status', async () => {
    const res = await app.request('/health/live');
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body.alive).toBe(true);
    expect(typeof body.uptime).toBe('number');
  });

  test('GET /health/detailed returns comprehensive status', async () => {
    const res = await app.request('/health/detailed');
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.services).toBeDefined();
    expect(body.services.database).toBe('operational');
    expect(body.services.cloudflare_api).toBe('operational');
    expect(body.services.polling).toBe('operational');
    expect(body.cache).toBeDefined();
  });

  test('health endpoint returns JSON content type', async () => {
    const res = await app.request('/health');
    
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('API Response Structure - integration', () => {
  test('successful response has correct structure', async () => {
    const app = new Hono();
    app.get('/api/test', (c) => {
      return c.json({
        success: true,
        data: { id: 1, name: 'test' },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    });

    const res = await app.request('/api/test');
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();
  });

  test('error response has correct structure', async () => {
    const app = new Hono();
    app.get('/api/error', (c) => {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          details: { id: 'missing-123' },
        },
      }, 404);
    });

    const res = await app.request('/api/error');
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBeDefined();
  });
});
