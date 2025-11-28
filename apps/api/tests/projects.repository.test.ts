/**
 * Projects Repository Tests
 * 
 * Unit tests for the projects database repository.
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { ProjectsRepository } from '../src/db/repositories/projects';
import type { CloudflareProject } from '@cloudflare-monitor/shared';

describe('ProjectsRepository', () => {
  let db: Database;
  let repo: ProjectsRepository;

  const mockProject: CloudflareProject = {
    id: 'proj-test-123',
    name: 'test-project',
    accountId: 'account-456',
    createdAt: new Date().toISOString(),
    production_branch: 'main',
  };

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Create schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        account_id TEXT NOT NULL,
        subdomain TEXT,
        production_branch TEXT,
        created_at TEXT NOT NULL,
        last_synced_at TEXT NOT NULL,
        metadata TEXT
      )
    `);

    repo = new ProjectsRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('upsert inserts new project', () => {
    repo.upsert(mockProject);
    
    const count = repo.count();
    expect(count).toBe(1);
  });

  test('upsert updates existing project', () => {
    repo.upsert(mockProject);
    
    const updatedProject = {
      ...mockProject,
      production_branch: 'develop',
    };
    repo.upsert(updatedProject);
    
    const count = repo.count();
    expect(count).toBe(1);
    
    const project = repo.findById(mockProject.id);
    expect(project?.production_branch).toBe('develop');
  });

  test('upsertMany inserts multiple projects', () => {
    const projects: CloudflareProject[] = [
      { ...mockProject, id: 'proj-1', name: 'project-1' },
      { ...mockProject, id: 'proj-2', name: 'project-2' },
      { ...mockProject, id: 'proj-3', name: 'project-3' },
    ];
    
    repo.upsertMany(projects);
    
    const count = repo.count();
    expect(count).toBe(3);
  });

  test('findAll returns all projects', () => {
    const projects: CloudflareProject[] = [
      { ...mockProject, id: 'proj-1', name: 'project-1' },
      { ...mockProject, id: 'proj-2', name: 'project-2' },
    ];
    repo.upsertMany(projects);
    
    const results = repo.findAll();
    expect(results.length).toBe(2);
  });

  test('findById returns correct project', () => {
    repo.upsert(mockProject);
    
    const result = repo.findById(mockProject.id);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('test-project');
  });

  test('findById returns null for non-existent project', () => {
    const result = repo.findById('non-existent-id');
    expect(result).toBeNull();
  });

  test('findByName returns correct project', () => {
    repo.upsert(mockProject);
    
    const result = repo.findByName('test-project');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('proj-test-123');
  });

  test('findByName returns null for non-existent project', () => {
    const result = repo.findByName('non-existent');
    expect(result).toBeNull();
  });

  test('count returns total count', () => {
    expect(repo.count()).toBe(0);
    
    repo.upsert(mockProject);
    expect(repo.count()).toBe(1);
    
    repo.upsert({ ...mockProject, id: 'proj-2', name: 'project-2' });
    expect(repo.count()).toBe(2);
  });

  test('findAll orders by name', () => {
    const projects: CloudflareProject[] = [
      { ...mockProject, id: 'proj-c', name: 'charlie' },
      { ...mockProject, id: 'proj-a', name: 'alpha' },
      { ...mockProject, id: 'proj-b', name: 'bravo' },
    ];
    repo.upsertMany(projects);
    
    const results = repo.findAll();
    expect(results[0].name).toBe('alpha');
    expect(results[1].name).toBe('bravo');
    expect(results[2].name).toBe('charlie');
  });

  test('handles project without production_branch', () => {
    const projectWithoutBranch: CloudflareProject = {
      id: 'proj-no-branch',
      name: 'no-branch-project',
      accountId: 'account-456',
      createdAt: new Date().toISOString(),
    };
    
    repo.upsert(projectWithoutBranch);
    
    const result = repo.findById('proj-no-branch');
    expect(result).not.toBeNull();
    // Database returns null for missing values
    expect(result?.production_branch).toBeNull();
  });
});
