/**
 * Schema Validation Tests
 * 
 * Tests for Zod schemas ensuring runtime validation works correctly.
 */

import { describe, expect, test } from 'bun:test';
import {
  envSchema,
  deploymentStatusSchema,
  cloudflareDeploymentSchema,
  cloudflareProjectSchema,
  healthStatusSchema,
} from '../src/schemas';

describe('envSchema', () => {
  test('validates complete config', () => {
    const validConfig = {
      CLOUDFLARE_API_TOKEN: 'test-token-123',
      CLOUDFLARE_ACCOUNT_ID: 'account-123',
      API_PORT: '3001',
      NODE_ENV: 'development',
      POLL_INTERVAL_MS: '5000',
      DATABASE_PATH: './data/test.db',
    };

    const result = envSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.API_PORT).toBe(3001);
      expect(result.data.POLL_INTERVAL_MS).toBe(5000);
    }
  });

  test('applies defaults for optional fields', () => {
    const minimalConfig = {
      CLOUDFLARE_API_TOKEN: 'test-token',
      CLOUDFLARE_ACCOUNT_ID: 'account-id',
    };

    const result = envSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.API_PORT).toBe(3001);
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.FAILURE_RETENTION_DAYS).toBe(7);
    }
  });

  test('rejects missing required fields', () => {
    const invalidConfig = {
      CLOUDFLARE_API_TOKEN: 'test-token',
      // Missing CLOUDFLARE_ACCOUNT_ID
    };

    const result = envSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  test('rejects empty API token', () => {
    const invalidConfig = {
      CLOUDFLARE_API_TOKEN: '',
      CLOUDFLARE_ACCOUNT_ID: 'account-id',
    };

    const result = envSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  test('coerces string numbers to numbers', () => {
    const config = {
      CLOUDFLARE_API_TOKEN: 'token',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      API_PORT: '8080',
      POLL_INTERVAL_MS: '10000',
    };

    const result = envSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.API_PORT).toBe('number');
      expect(result.data.API_PORT).toBe(8080);
    }
  });

  test('validates NODE_ENV enum', () => {
    const validEnvs = ['development', 'production', 'test'];
    
    for (const env of validEnvs) {
      const result = envSchema.safeParse({
        CLOUDFLARE_API_TOKEN: 'token',
        CLOUDFLARE_ACCOUNT_ID: 'account',
        NODE_ENV: env,
      });
      expect(result.success).toBe(true);
    }

    const invalidResult = envSchema.safeParse({
      CLOUDFLARE_API_TOKEN: 'token',
      CLOUDFLARE_ACCOUNT_ID: 'account',
      NODE_ENV: 'invalid',
    });
    expect(invalidResult.success).toBe(false);
  });
});

describe('deploymentStatusSchema', () => {
  test('accepts valid statuses', () => {
    const validStatuses = ['active', 'building', 'deploying', 'failure', 'queued', 'cancelled'];
    
    for (const status of validStatuses) {
      const result = deploymentStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  test('rejects invalid status', () => {
    const result = deploymentStatusSchema.safeParse('invalid-status');
    expect(result.success).toBe(false);
  });
});

describe('cloudflareDeploymentSchema', () => {
  const validDeployment = {
    id: 'deploy-123',
    projectId: 'proj-456',
    projectName: 'my-project',
    environment: 'production',
    url: 'https://my-project.pages.dev',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
  };

  test('validates complete deployment', () => {
    const result = cloudflareDeploymentSchema.safeParse(validDeployment);
    expect(result.success).toBe(true);
  });

  test('validates deployment with optional fields', () => {
    const deploymentWithStage = {
      ...validDeployment,
      latestStage: {
        name: 'build',
        status: 'success',
        startedAt: '2024-01-01T00:00:00Z',
        endedAt: '2024-01-01T00:01:00Z',
      },
      aliases: ['alias1.pages.dev', 'alias2.pages.dev'],
    };

    const result = cloudflareDeploymentSchema.safeParse(deploymentWithStage);
    expect(result.success).toBe(true);
  });

  test('validates environment enum', () => {
    const productionResult = cloudflareDeploymentSchema.safeParse({
      ...validDeployment,
      environment: 'production',
    });
    expect(productionResult.success).toBe(true);

    const previewResult = cloudflareDeploymentSchema.safeParse({
      ...validDeployment,
      environment: 'preview',
    });
    expect(previewResult.success).toBe(true);

    const invalidResult = cloudflareDeploymentSchema.safeParse({
      ...validDeployment,
      environment: 'staging',
    });
    expect(invalidResult.success).toBe(false);
  });

  test('requires valid URL', () => {
    const invalidResult = cloudflareDeploymentSchema.safeParse({
      ...validDeployment,
      url: 'not-a-url',
    });
    expect(invalidResult.success).toBe(false);
  });
});

describe('cloudflareProjectSchema', () => {
  test('validates complete project', () => {
    const validProject = {
      id: 'proj-123',
      name: 'my-project',
      accountId: 'account-456',
      createdAt: '2024-01-01T00:00:00Z',
      production_branch: 'main',
    };

    const result = cloudflareProjectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
  });

  test('allows optional production_branch', () => {
    const projectWithoutBranch = {
      id: 'proj-123',
      name: 'my-project',
      accountId: 'account-456',
      createdAt: '2024-01-01T00:00:00Z',
    };

    const result = cloudflareProjectSchema.safeParse(projectWithoutBranch);
    expect(result.success).toBe(true);
  });
});

describe('healthStatusSchema', () => {
  test('validates healthy status', () => {
    const healthyStatus = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 3600,
      services: {
        database: 'operational',
        cloudflare_api: 'operational',
        polling: 'operational',
      },
    };

    const result = healthStatusSchema.safeParse(healthyStatus);
    expect(result.success).toBe(true);
  });

  test('validates degraded status', () => {
    const degradedStatus = {
      status: 'degraded',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 3600,
      services: {
        database: 'operational',
        cloudflare_api: 'degraded',
        polling: 'operational',
      },
    };

    const result = healthStatusSchema.safeParse(degradedStatus);
    expect(result.success).toBe(true);
  });

  test('rejects invalid service status', () => {
    const invalidStatus = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 3600,
      services: {
        database: 'working', // Invalid - should be operational/degraded/down
        cloudflare_api: 'operational',
        polling: 'operational',
      },
    };

    const result = healthStatusSchema.safeParse(invalidStatus);
    expect(result.success).toBe(false);
  });
});
