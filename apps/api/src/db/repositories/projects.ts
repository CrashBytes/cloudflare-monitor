/**
 * Projects Repository
 * 
 * Implements the Repository pattern for Projects data access
 * Encapsulates all database operations for projects table
 */

import type { Database } from 'bun:sqlite';
import type { CloudflareProject } from '@cloudflare-monitor/shared';

export class ProjectsRepository {
  constructor(private db: Database) {}

  /**
   * Insert or update project (upsert pattern)
   * Uses ON CONFLICT for idempotent operations
   */
  upsert(project: CloudflareProject): void {
    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, name, account_id, subdomain, production_branch, created_at, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        subdomain = excluded.subdomain,
        production_branch = excluded.production_branch,
        last_synced_at = datetime('now')
    `);

    stmt.run(
      project.id,
      project.name,
      project.accountId,
      project.id, // subdomain fallback
      project.production_branch || null,
      project.createdAt
    );
  }

  /**
   * Bulk upsert projects within a transaction
   * Atomic operation for consistency
   */
  upsertMany(projects: CloudflareProject[]): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO projects (
        id, name, account_id, subdomain, production_branch, created_at, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        subdomain = excluded.subdomain,
        production_branch = excluded.production_branch,
        last_synced_at = datetime('now')
    `);

    const transaction = this.db.transaction(() => {
      for (const project of projects) {
        insertStmt.run(
          project.id,
          project.name,
          project.accountId,
          project.id,
          project.production_branch || null,
          project.createdAt
        );
      }
    });

    transaction();
  }

  /**
   * Find all projects
   */
  findAll(): CloudflareProject[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, name, account_id as accountId, subdomain,
        production_branch as production_branch, created_at as createdAt
      FROM projects
      ORDER BY name ASC
    `);

    return stmt.all() as CloudflareProject[];
  }

  /**
   * Find project by ID
   */
  findById(id: string): CloudflareProject | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, name, account_id as accountId, subdomain,
        production_branch as production_branch, created_at as createdAt
      FROM projects
      WHERE id = ?
    `);

    return (stmt.get(id) as CloudflareProject) || null;
  }

  /**
   * Find project by name
   */
  findByName(name: string): CloudflareProject | null {
    const stmt = this.db.prepare(`
      SELECT 
        id, name, account_id as accountId, subdomain,
        production_branch as production_branch, created_at as createdAt
      FROM projects
      WHERE name = ?
    `);

    return (stmt.get(name) as CloudflareProject) || null;
  }

  /**
   * Count total projects
   */
  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM projects');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Delete project by ID
   * Cascade deletes related deployments via foreign key
   */
  deleteById(id: string): void {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }
}
