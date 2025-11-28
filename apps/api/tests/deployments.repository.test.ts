/**
 * Deployments Repository Tests
 * 
 * Unit tests for the deployments database repository.
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { DeploymentsRepository } from '../src/db/repositories/deployments';
import type { CloudflareDeployment } from '@cloudflare-monitor/shared';

describe('DeploymentsRepository', () => {
  let db: Database;
  let repo: DeploymentsRepository;

  const mockDeployment: CloudflareDeployment = {
    id: 'deploy-test-123',
    projectId: 'proj-456',
    projectName: 'test-project',
    environment: 'production',
    url: 'https://test.pages.dev',
    status: 'active',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Create schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY,
        short_id TEXT,
        project_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        environment TEXT NOT NULL CHECK(environment IN ('production', 'preview')),
        url TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'building', 'deploying', 'failure', 'queued', 'cancelled')),
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        last_synced_at TEXT NOT NULL,
        stage_name TEXT,
        stage_status TEXT,
        stage_started_at TEXT,
        stage_ended_at TEXT,
        metadata TEXT
      )
    `);

    repo = new DeploymentsRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('upsert inserts new deployment', () => {
    repo.upsert(mockDeployment);
    
    const count = repo.count();
    expect(count).toBe(1);
  });

  test('upsert updates existing deployment', () => {
    repo.upsert(mockDeployment);
    
    const updatedDeployment = {
      ...mockDeployment,
      status: 'failure' as const,
    };
    repo.upsert(updatedDeployment);
    
    const count = repo.count();
    expect(count).toBe(1);
    
    const deployments = repo.findByStatus('failure');
    expect(deployments.length).toBe(1);
  });

  test('upsertMany inserts multiple deployments', () => {
    const deployments: CloudflareDeployment[] = [
      { ...mockDeployment, id: 'deploy-1' },
      { ...mockDeployment, id: 'deploy-2' },
      { ...mockDeployment, id: 'deploy-3' },
    ];
    
    repo.upsertMany(deployments);
    
    const count = repo.count();
    expect(count).toBe(3);
  });

  test('findAll returns all deployments', () => {
    const deployments: CloudflareDeployment[] = [
      { ...mockDeployment, id: 'deploy-1' },
      { ...mockDeployment, id: 'deploy-2' },
    ];
    repo.upsertMany(deployments);
    
    const results = repo.findAll();
    expect(results.length).toBe(2);
  });

  test('findByProjectId filters by project', () => {
    const deployments: CloudflareDeployment[] = [
      { ...mockDeployment, id: 'deploy-1', projectId: 'proj-A' },
      { ...mockDeployment, id: 'deploy-2', projectId: 'proj-A' },
      { ...mockDeployment, id: 'deploy-3', projectId: 'proj-B' },
    ];
    repo.upsertMany(deployments);
    
    const results = repo.findByProjectId('proj-A');
    expect(results.length).toBe(2);
  });

  test('findByStatus filters by status', () => {
    const deployments: CloudflareDeployment[] = [
      { ...mockDeployment, id: 'deploy-1', status: 'active' },
      { ...mockDeployment, id: 'deploy-2', status: 'active' },
      { ...mockDeployment, id: 'deploy-3', status: 'failure' },
    ];
    repo.upsertMany(deployments);
    
    const activeResults = repo.findByStatus('active');
    expect(activeResults.length).toBe(2);
    
    const failureResults = repo.findByStatus('failure');
    expect(failureResults.length).toBe(1);
  });

  test('countByStatus returns correct count', () => {
    const deployments: CloudflareDeployment[] = [
      { ...mockDeployment, id: 'deploy-1', status: 'active' },
      { ...mockDeployment, id: 'deploy-2', status: 'active' },
      { ...mockDeployment, id: 'deploy-3', status: 'failure' },
      { ...mockDeployment, id: 'deploy-4', status: 'building' },
    ];
    repo.upsertMany(deployments);
    
    expect(repo.countByStatus('active')).toBe(2);
    expect(repo.countByStatus('failure')).toBe(1);
    expect(repo.countByStatus('building')).toBe(1);
    expect(repo.countByStatus('queued')).toBe(0);
  });

  test('count returns total count', () => {
    expect(repo.count()).toBe(0);
    
    repo.upsert(mockDeployment);
    expect(repo.count()).toBe(1);
    
    repo.upsert({ ...mockDeployment, id: 'deploy-2' });
    expect(repo.count()).toBe(2);
  });

  test('findRecent filters by date', () => {
    // Create deployments with different dates
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    
    const newDate = new Date();
    
    const deployments: CloudflareDeployment[] = [
      { ...mockDeployment, id: 'deploy-old', createdAt: oldDate.toISOString() },
      { ...mockDeployment, id: 'deploy-new', createdAt: newDate.toISOString() },
    ];
    repo.upsertMany(deployments);
    
    const recentResults = repo.findRecent(7);
    expect(recentResults.length).toBe(1);
    expect(recentResults[0].id).toBe('deploy-new');
  });

  test('findByStatusRecent filters by status and date', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    
    const newDate = new Date();
    
    const deployments: CloudflareDeployment[] = [
      { ...mockDeployment, id: 'old-failure', status: 'failure', createdAt: oldDate.toISOString() },
      { ...mockDeployment, id: 'new-failure', status: 'failure', createdAt: newDate.toISOString() },
      { ...mockDeployment, id: 'new-active', status: 'active', createdAt: newDate.toISOString() },
    ];
    repo.upsertMany(deployments);
    
    const recentFailures = repo.findByStatusRecent('failure', 7);
    expect(recentFailures.length).toBe(1);
    expect(recentFailures[0].id).toBe('new-failure');
  });

  test('countByStatusRecent counts only recent', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    
    const newDate = new Date();
    
    const deployments: CloudflareDeployment[] = [
      { ...mockDeployment, id: 'old-failure-1', status: 'failure', createdAt: oldDate.toISOString() },
      { ...mockDeployment, id: 'old-failure-2', status: 'failure', createdAt: oldDate.toISOString() },
      { ...mockDeployment, id: 'new-failure', status: 'failure', createdAt: newDate.toISOString() },
    ];
    repo.upsertMany(deployments);
    
    // All failures
    expect(repo.countByStatus('failure')).toBe(3);
    
    // Only recent failures
    expect(repo.countByStatusRecent('failure', 7)).toBe(1);
  });
});
