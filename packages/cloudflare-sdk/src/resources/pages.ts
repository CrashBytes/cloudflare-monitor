/**
 * Cloudflare Pages Resource Handler
 * 
 * Encapsulates Pages-specific API operations with type safety
 * Implements the Repository pattern for clean abstraction
 */

import type { CloudflareClient, CloudflareAPIResponse } from '../client';

export interface PagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  source?: {
    type: string;
    config: {
      owner: string;
      repo_name: string;
      production_branch: string;
    };
  };
  build_config?: {
    build_command?: string;
    destination_dir?: string;
    root_dir?: string;
  };
  created_on: string;
  production_branch?: string;
  deployment_configs: {
    production: DeploymentConfig;
    preview: DeploymentConfig;
  };
}

export interface DeploymentConfig {
  env_vars?: Record<string, { value: string; type: string }>;
  compatibility_date?: string;
  compatibility_flags?: string[];
}

export interface PagesDeployment {
  id: string;
  short_id: string;
  project_id: string;
  project_name: string;
  environment: 'production' | 'preview';
  url: string;
  created_on: string;
  modified_on: string;
  latest_stage: {
    name: string;
    status: 'idle' | 'active' | 'success' | 'failure' | 'skipped' | 'cancelled';
    started_on: string | null;
    ended_on: string | null;
  };
  deployment_trigger: {
    type: string;
    metadata: {
      branch?: string;
      commit_hash?: string;
      commit_message?: string;
    };
  };
  stages: Array<{
    name: string;
    status: string;
    started_on: string | null;
    ended_on: string | null;
  }>;
  build_config: {
    build_command?: string;
    destination_dir?: string;
    root_dir?: string;
  };
  aliases: string[];
}

export class PagesResource {
  constructor(private client: CloudflareClient, private accountId: string) {}

  /**
   * List all Pages projects
   * Retrieves project metadata without deployment details for performance
   */
  async listProjects(): Promise<PagesProject[]> {
    const response = await this.client.get<PagesProject[]>(
      `/accounts/${this.accountId}/pages/projects`
    );
    return response.result;
  }

  /**
   * Get specific Pages project
   * Includes full project configuration and deployment settings
   */
  async getProject(projectName: string): Promise<PagesProject> {
    const response = await this.client.get<PagesProject>(
      `/accounts/${this.accountId}/pages/projects/${projectName}`
    );
    return response.result;
  }

  /**
   * List deployments for a project
   * Cloudflare Pages API doesn't use standard page/per_page pagination
   * It returns all recent deployments by default
   */
  async listDeployments(
    projectName: string
  ): Promise<CloudflareAPIResponse<PagesDeployment[]>> {
    const endpoint = `/accounts/${this.accountId}/pages/projects/${projectName}/deployments`;
    return this.client.get<PagesDeployment[]>(endpoint);
  }

  /**
   * Get specific deployment details
   * Includes full stage information and build logs
   */
  async getDeployment(
    projectName: string,
    deploymentId: string
  ): Promise<PagesDeployment> {
    const response = await this.client.get<PagesDeployment>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/deployments/${deploymentId}`
    );
    return response.result;
  }

  /**
   * Get latest production deployment
   * Optimized query for monitoring active production state
   */
  async getLatestProduction(projectName: string): Promise<PagesDeployment | null> {
    const response = await this.listDeployments(projectName);
    
    const productionDeployments = response.result.filter(
      d => d.environment === 'production'
    );

    return productionDeployments[0] || null;
  }
}
