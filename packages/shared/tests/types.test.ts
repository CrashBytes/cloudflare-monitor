/**
 * Type Utility Tests
 * 
 * Tests for type definitions and utility functions.
 */

import { describe, expect, test } from 'bun:test';
import type { 
  CloudflareDeployment, 
  CloudflareProject,
  DeploymentStatus,
  APIResponse,
  SSEMessage,
} from '../src/types';

describe('Type Definitions', () => {
  test('CloudflareDeployment type structure', () => {
    const deployment: CloudflareDeployment = {
      id: 'deploy-123',
      projectId: 'proj-456',
      projectName: 'test-project',
      environment: 'production',
      url: 'https://test.pages.dev',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      modifiedAt: '2024-01-01T00:00:00Z',
    };

    expect(deployment.id).toBe('deploy-123');
    expect(deployment.environment).toBe('production');
    expect(deployment.status).toBe('active');
  });

  test('CloudflareDeployment with optional fields', () => {
    const deployment: CloudflareDeployment = {
      id: 'deploy-123',
      projectId: 'proj-456',
      projectName: 'test-project',
      environment: 'preview',
      url: 'https://test.pages.dev',
      status: 'building',
      createdAt: '2024-01-01T00:00:00Z',
      modifiedAt: '2024-01-01T00:00:00Z',
      latestStage: {
        name: 'build',
        status: 'active',
        startedAt: '2024-01-01T00:00:00Z',
      },
      aliases: ['alias1.pages.dev'],
    };

    expect(deployment.latestStage?.name).toBe('build');
    expect(deployment.aliases?.length).toBe(1);
  });

  test('CloudflareProject type structure', () => {
    const project: CloudflareProject = {
      id: 'proj-123',
      name: 'my-project',
      accountId: 'account-456',
      createdAt: '2024-01-01T00:00:00Z',
      production_branch: 'main',
    };

    expect(project.name).toBe('my-project');
    expect(project.production_branch).toBe('main');
  });

  test('DeploymentStatus type exhaustiveness', () => {
    const statuses: DeploymentStatus[] = [
      'active',
      'building',
      'deploying',
      'failure',
      'queued',
      'cancelled',
    ];

    expect(statuses.length).toBe(6);
    expect(statuses).toContain('active');
    expect(statuses).toContain('failure');
  });

  test('APIResponse success structure', () => {
    const response: APIResponse<CloudflareProject[]> = {
      success: true,
      data: [{
        id: 'proj-1',
        name: 'project-1',
        accountId: 'account-1',
        createdAt: '2024-01-01T00:00:00Z',
      }],
      meta: {
        timestamp: '2024-01-01T00:00:00Z',
        total: 1,
      },
    };

    expect(response.success).toBe(true);
    expect(response.data?.length).toBe(1);
  });

  test('APIResponse error structure', () => {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        details: { id: 'missing-123' },
      },
    };

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('NOT_FOUND');
  });

  test('SSEMessage structure', () => {
    const message: SSEMessage<CloudflareDeployment> = {
      event: 'deployment_update',
      data: {
        id: 'deploy-123',
        projectId: 'proj-456',
        projectName: 'test',
        environment: 'production',
        url: 'https://test.pages.dev',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
      },
      timestamp: '2024-01-01T00:00:00Z',
    };

    expect(message.event).toBe('deployment_update');
    expect(message.data.status).toBe('active');
  });
});
