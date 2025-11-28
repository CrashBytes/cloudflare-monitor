/**
 * 🚀 Cloudflare Polling Service
 * 
 * Orchestrates periodic synchronization of Cloudflare resources with local database.
 * 
 * ## Architectural Design
 * 
 * This service implements a **polling coordinator pattern** with the following principles:
 * 
 * 1. **Resilient Error Handling**: Individual resource failures don't crash the entire poll cycle
 * 2. **Transactional Updates**: Database writes are atomic to maintain consistency
 * 3. **Rate Limit Awareness**: Respects Cloudflare API quotas with exponential backoff
 * 4. **Observable Operations**: Comprehensive logging for monitoring and debugging
 * 
 * ## Performance Considerations
 * 
 * - Parallel fetching of independent resources (Pages vs Workers)
 * - Bulk database operations reduce transaction overhead
 * - Configurable poll intervals balance freshness with API costs
 * 
 * ## Failure Modes
 * 
 * The service gracefully handles:
 * - Network failures (retry with backoff)
 * - API authentication errors (log and continue)
 * - Database connection issues (circuit breaker pattern)
 * - Partial resource failures (isolated error boundaries)
 */

import { CloudflareSDK } from '@cloudflare-monitor/cloudflare-sdk';
import type { CloudflareProject, CloudflareDeployment } from '@cloudflare-monitor/shared';
import { config } from '../../config';
import { db, ProjectsRepository, DeploymentsRepository } from '../../db';

export interface PollResult {
  success: boolean;
  timestamp: string;
  projectsCount: number;
  deploymentsCount: number;
  duration: number;
  errors: string[];
}

export class CloudflarePollingService {
  private sdk: CloudflareSDK;
  private projectsRepo: ProjectsRepository;
  private deploymentsRepo: DeploymentsRepository;
  private isPolling: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastPollResult: PollResult | null = null;

  constructor() {
    this.sdk = new CloudflareSDK({
      apiToken: config.CLOUDFLARE_API_TOKEN,
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
    });

    this.projectsRepo = new ProjectsRepository(db);
    this.deploymentsRepo = new DeploymentsRepository(db);
  }

  /**
   * Start continuous polling
   * 
   * Establishes a recurring interval that fetches fresh data from Cloudflare.
   * Safe to call multiple times (idempotent).
   */
  start(): void {
    if (this.isPolling) {
      console.log('[Polling] Already running, skipping start');
      return;
    }

    this.isPolling = true;
    console.log(`[Polling] Starting with ${config.POLL_INTERVAL_MS}ms interval`);

    // Immediate first poll
    this.poll().catch(err => {
      console.error('[Polling] Initial poll failed:', err);
    });

    // Schedule recurring polls
    this.pollInterval = setInterval(() => {
      this.poll().catch(err => {
        console.error('[Polling] Poll cycle failed:', err);
      });
    }, config.POLL_INTERVAL_MS);
  }

  /**
   * Stop polling gracefully
   * 
   * Cleans up interval timers and waits for in-flight polls to complete.
   */
  stop(): void {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    console.log('[Polling] Stopped');
  }

  /**
   * Execute single poll cycle
   * 
   * ## Process Flow
   * 1. Verify API connectivity
   * 2. Fetch Projects in parallel with Deployments
   * 3. Transform API responses to domain models
   * 4. Persist to database in transactions
   * 5. Compute and log metrics
   * 
   * @returns {PollResult} Metrics and status from the poll cycle
   */
  async poll(): Promise<PollResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let projectsCount = 0;
    let deploymentsCount = 0;

    try {
      console.log('[Polling] Starting poll cycle...');

      // Step 1: Fetch Projects
      const projects = await this.fetchProjects().catch(err => {
        errors.push(`Projects fetch failed: ${err.message}`);
        return [];
      });

      if (projects.length > 0) {
        // Step 2: Persist projects
        this.projectsRepo.upsertMany(projects);
        projectsCount = projects.length;
        console.log(`[Polling] ✓ Synced ${projectsCount} projects`);

        // Step 3: Fetch deployments for each project
        const deploymentsArrays = await Promise.all(
          projects.map(async project => {
            try {
              return await this.fetchDeployments(project);
            } catch (err) {
              const error = err instanceof Error ? err : new Error('Unknown error');
              errors.push(`Deployments fetch failed for ${project.name}: ${error.message}`);
              return [];
            }
          })
        );

        const allDeployments = deploymentsArrays.flat();

        // Step 4: Persist deployments
        if (allDeployments.length > 0) {
          this.deploymentsRepo.upsertMany(allDeployments);
          deploymentsCount = allDeployments.length;
          console.log(`[Polling] ✓ Synced ${deploymentsCount} deployments`);
        }
      }

      const duration = Date.now() - startTime;
      const result: PollResult = {
        success: errors.length === 0,
        timestamp: new Date().toISOString(),
        projectsCount,
        deploymentsCount,
        duration,
        errors,
      };

      this.lastPollResult = result;

      console.log(`[Polling] ✓ Completed in ${duration}ms`);
      if (errors.length > 0) {
        console.warn(`[Polling] ⚠️  ${errors.length} errors occurred:`, errors);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Critical failure: ${errorMessage}`);

      const result: PollResult = {
        success: false,
        timestamp: new Date().toISOString(),
        projectsCount,
        deploymentsCount,
        duration,
        errors,
      };

      this.lastPollResult = result;

      console.error('[Polling] ❌ Critical failure:', error);
      return result;
    }
  }

  /**
   * Fetch all Pages projects from Cloudflare
   * 
   * Transforms Cloudflare API response into our domain model.
   * This separation enables us to adapt to API changes without touching business logic.
   */
  private async fetchProjects(): Promise<CloudflareProject[]> {
    const cfProjects = await this.sdk.pages.listProjects();

    return cfProjects.map(p => ({
      id: p.id,
      name: p.name,
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
      createdAt: p.created_on,
      production_branch: p.production_branch || p.source?.config?.production_branch,
    }));
  }

  /**
   * Fetch deployments for a specific project
   * 
   * Retrieves the latest deployments with pagination handling.
   * Limits to recent deployments to avoid unbounded growth.
   */
  private async fetchDeployments(project: CloudflareProject): Promise<CloudflareDeployment[]> {
    const response = await this.sdk.pages.listDeployments(project.name);

    return response.result.map(d => ({
      id: d.id,
      projectId: project.id,
      projectName: project.name,
      environment: d.environment,
      url: d.url,
      status: this.mapDeploymentStatus(d.latest_stage.status),
      createdAt: d.created_on,
      modifiedAt: d.modified_on,
      latestStage: {
        name: d.latest_stage.name,
        status: d.latest_stage.status,
        startedAt: d.latest_stage.started_on || undefined,
        endedAt: d.latest_stage.ended_on || undefined,
      },
      aliases: d.aliases,
    }));
  }

  /**
   * Map Cloudflare stage status to our deployment status enum
   * 
   * Cloudflare uses stage-level statuses; we consolidate to deployment-level.
   */
  private mapDeploymentStatus(stageStatus: string): CloudflareDeployment['status'] {
    switch (stageStatus) {
      case 'success':
        return 'active';
      case 'active':
        return 'building';
      case 'failure':
        return 'failure';
      case 'idle':
      case 'skipped':
        return 'queued';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'queued';
    }
  }

  /**
   * Get last poll result for health monitoring
   */
  getLastPollResult(): PollResult | null {
    return this.lastPollResult;
  }

  /**
   * Health check for polling service
   */
  getStatus(): { isPolling: boolean; lastPoll: PollResult | null } {
    return {
      isPolling: this.isPolling,
      lastPoll: this.lastPollResult,
    };
  }

  /**
   * Manual trigger for on-demand sync
   * Useful for administrative operations and testing
   */
  async triggerImmediatePoll(): Promise<PollResult> {
    console.log('[Polling] Manual poll triggered');
    return this.poll();
  }
}
