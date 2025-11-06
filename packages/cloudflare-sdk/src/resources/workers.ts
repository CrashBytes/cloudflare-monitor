/**
 * Cloudflare Workers Resource Handler
 * 
 * Manages Workers scripts, routes, and deployment metadata
 * Implements defensive programming with comprehensive error handling
 */

import type { CloudflareClient } from '../client';

export interface WorkerScript {
  id: string;
  script: string;
  etag: string;
  created_on: string;
  modified_on: string;
  usage_model: 'bundled' | 'unbound';
  logpush: boolean;
  tail_consumers?: Array<{
    service: string;
    environment?: string;
  }>;
}

export interface WorkerMetadata {
  id: string;
  etag: string;
  created_on: string;
  modified_on: string;
}

export interface WorkerRoute {
  id: string;
  pattern: string;
  script?: string;
  zone_id?: string;
  zone_name?: string;
}

export interface WorkerCronTrigger {
  cron: string;
  created_on: string;
  modified_on: string;
}

export class WorkersResource {
  constructor(private client: CloudflareClient, private accountId: string) {}

  /**
   * List all Workers scripts
   * Returns metadata without script content for performance
   */
  async listWorkers(): Promise<WorkerMetadata[]> {
    const response = await this.client.get<WorkerMetadata[]>(
      `/accounts/${this.accountId}/workers/scripts`
    );
    return response.result;
  }

  /**
   * Get specific Worker script with content
   * Includes script code, configuration, and bindings
   */
  async getWorker(scriptName: string): Promise<WorkerScript> {
    const response = await this.client.get<WorkerScript>(
      `/accounts/${this.accountId}/workers/scripts/${scriptName}`
    );
    return response.result;
  }

  /**
   * Get Worker settings without script content
   * Optimized for monitoring and status checks
   */
  async getWorkerSettings(scriptName: string): Promise<{
    usage_model: string;
    bindings: Array<{ type: string; name: string }>;
    logpush: boolean;
  }> {
    const response = await this.client.get<{
      usage_model: string;
      bindings: Array<{ type: string; name: string }>;
      logpush: boolean;
    }>(`/accounts/${this.accountId}/workers/scripts/${scriptName}/settings`);
    return response.result;
  }

  /**
   * List all Worker routes
   * Retrieves global routing configuration
   */
  async listRoutes(): Promise<WorkerRoute[]> {
    const response = await this.client.get<WorkerRoute[]>(
      `/accounts/${this.accountId}/workers/routes`
    );
    return response.result;
  }

  /**
   * Get routes for specific Worker
   * Filters routes by script name
   */
  async getWorkerRoutes(scriptName: string): Promise<WorkerRoute[]> {
    const allRoutes = await this.listRoutes();
    return allRoutes.filter(route => route.script === scriptName);
  }

  /**
   * List cron triggers for a Worker
   * Retrieves scheduled execution configuration
   */
  async listCronTriggers(scriptName: string): Promise<WorkerCronTrigger[]> {
    const response = await this.client.get<WorkerCronTrigger[]>(
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/schedules`
    );
    return response.result;
  }

  /**
   * Get Worker usage analytics
   * Retrieves execution metrics and performance data
   */
  async getUsageMetrics(
    scriptName: string,
    options?: {
      since?: string; // ISO 8601 datetime
      until?: string; // ISO 8601 datetime
    }
  ): Promise<{
    requests: number;
    errors: number;
    subrequests: number;
    cpu_time: number;
  }> {
    const queryParams = new URLSearchParams();
    if (options?.since) queryParams.set('since', options.since);
    if (options?.until) queryParams.set('until', options.until);

    const query = queryParams.toString();
    const endpoint = `/accounts/${this.accountId}/workers/scripts/${scriptName}/usage${query ? `?${query}` : ''}`;

    const response = await this.client.get<{
      requests: number;
      errors: number;
      subrequests: number;
      cpu_time: number;
    }>(endpoint);

    return response.result;
  }

  /**
   * Check if Worker is deployed
   * Fast existence check without retrieving script content
   */
  async exists(scriptName: string): Promise<boolean> {
    try {
      await this.client.get(`/accounts/${this.accountId}/workers/scripts/${scriptName}`);
      return true;
    } catch (error) {
      // 404 indicates Worker doesn't exist
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      // Re-throw non-404 errors (auth failures, network issues, etc.)
      throw error;
    }
  }
}
