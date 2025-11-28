/**
 * Deployments Repository
 * 
 * Manages deployment records with optimized queries for monitoring dashboards
 */

import type { Database } from 'bun:sqlite';
import type { CloudflareDeployment, DeploymentStatus } from '@cloudflare-monitor/shared';

export class DeploymentsRepository {
  constructor(private db: Database) {}

  /**
   * Upsert deployment record
   */
  upsert(deployment: CloudflareDeployment): void {
    const stmt = this.db.prepare(`
      INSERT INTO deployments (
        id, short_id, project_id, project_name, environment, url, status,
        created_at, modified_at, last_synced_at, stage_name, stage_status,
        stage_started_at, stage_ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        modified_at = excluded.modified_at,
        last_synced_at = datetime('now'),
        stage_name = excluded.stage_name,
        stage_status = excluded.stage_status,
        stage_started_at = excluded.stage_started_at,
        stage_ended_at = excluded.stage_ended_at
    `);

    stmt.run(
      deployment.id,
      deployment.id.substring(0, 8),
      deployment.projectId,
      deployment.projectName,
      deployment.environment,
      deployment.url,
      deployment.status,
      deployment.createdAt,
      deployment.modifiedAt,
      deployment.latestStage?.name || null,
      deployment.latestStage?.status || null,
      deployment.latestStage?.startedAt || null,
      deployment.latestStage?.endedAt || null
    );
  }

  upsertMany(deployments: CloudflareDeployment[]): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO deployments (
        id, short_id, project_id, project_name, environment, url, status,
        created_at, modified_at, last_synced_at, stage_name, stage_status,
        stage_started_at, stage_ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        modified_at = excluded.modified_at,
        last_synced_at = datetime('now'),
        stage_name = excluded.stage_name,
        stage_status = excluded.stage_status,
        stage_started_at = excluded.stage_started_at,
        stage_ended_at = excluded.stage_ended_at
    `);

    const transaction = this.db.transaction(() => {
      for (const deployment of deployments) {
        insertStmt.run(
          deployment.id,
          deployment.id.substring(0, 8),
          deployment.projectId,
          deployment.projectName,
          deployment.environment,
          deployment.url,
          deployment.status,
          deployment.createdAt,
          deployment.modifiedAt,
          deployment.latestStage?.name || null,
          deployment.latestStage?.status || null,
          deployment.latestStage?.startedAt || null,
          deployment.latestStage?.endedAt || null
        );
      }
    });

    transaction();
  }

  findAll(): CloudflareDeployment[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, project_id as projectId, project_name as projectName,
        environment, url, status, created_at as createdAt,
        modified_at as modifiedAt
      FROM deployments
      ORDER BY modified_at DESC
    `);
    return stmt.all() as CloudflareDeployment[];
  }

  /**
   * Find recent deployments (within specified days)
   */
  findRecent(days: number = 7): CloudflareDeployment[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, project_id as projectId, project_name as projectName,
        environment, url, status, created_at as createdAt,
        modified_at as modifiedAt
      FROM deployments
      WHERE created_at >= datetime('now', ?)
      ORDER BY modified_at DESC
    `);
    return stmt.all(`-${days} days`) as CloudflareDeployment[];
  }

  findByProjectId(projectId: string): CloudflareDeployment[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, project_id as projectId, project_name as projectName,
        environment, url, status, created_at as createdAt,
        modified_at as modifiedAt
      FROM deployments
      WHERE project_id = ?
      ORDER BY modified_at DESC
    `);
    return stmt.all(projectId) as CloudflareDeployment[];
  }

  findByStatus(status: DeploymentStatus): CloudflareDeployment[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, project_id as projectId, project_name as projectName,
        environment, url, status, created_at as createdAt,
        modified_at as modifiedAt
      FROM deployments
      WHERE status = ?
      ORDER BY modified_at DESC
    `);
    return stmt.all(status) as CloudflareDeployment[];
  }

  /**
   * Find deployments by status within a time window
   */
  findByStatusRecent(status: DeploymentStatus, days: number = 7): CloudflareDeployment[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, project_id as projectId, project_name as projectName,
        environment, url, status, created_at as createdAt,
        modified_at as modifiedAt
      FROM deployments
      WHERE status = ? AND created_at >= datetime('now', ?)
      ORDER BY modified_at DESC
    `);
    return stmt.all(status, `-${days} days`) as CloudflareDeployment[];
  }

  countByStatus(status: DeploymentStatus): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM deployments WHERE status = ?');
    const result = stmt.get(status) as { count: number };
    return result.count;
  }

  /**
   * Count deployments by status within a time window
   * Used for failure counts to avoid showing stale failures
   */
  countByStatusRecent(status: DeploymentStatus, days: number = 7): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM deployments 
      WHERE status = ? AND created_at >= datetime('now', ?)
    `);
    const result = stmt.get(status, `-${days} days`) as { count: number };
    return result.count;
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM deployments');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Count recent deployments only
   */
  countRecent(days: number = 30): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM deployments 
      WHERE created_at >= datetime('now', ?)
    `);
    const result = stmt.get(`-${days} days`) as { count: number };
    return result.count;
  }
}
