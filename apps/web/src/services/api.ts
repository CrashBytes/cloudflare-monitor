/**
 * API Client Service
 * 
 * Handles all HTTP requests to the backend API
 */

import type { CloudflareProject, CloudflareDeployment, APIResponse } from '@cloudflare-monitor/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();
      return data as APIResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // Projects
  async getProjects(): Promise<APIResponse<CloudflareProject[]>> {
    return this.request<CloudflareProject[]>('/api/projects');
  }

  async getProject(id: string): Promise<APIResponse<CloudflareProject>> {
    return this.request<CloudflareProject>(`/api/projects/${id}`);
  }

  // Deployments
  async getDeployments(filters?: { status?: string; environment?: string }): Promise<APIResponse<CloudflareDeployment[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.environment) params.set('environment', filters.environment);
    
    const query = params.toString();
    return this.request<CloudflareDeployment[]>(`/api/deployments${query ? `?${query}` : ''}`);
  }

  async getDeployment(id: string): Promise<APIResponse<CloudflareDeployment>> {
    return this.request<CloudflareDeployment>(`/api/deployments/${id}`);
  }

  async getProjectDeployments(projectId: string): Promise<APIResponse<CloudflareDeployment[]>> {
    return this.request<CloudflareDeployment[]>(`/api/projects/${projectId}/deployments`);
  }

  // Health
  async getHealth(): Promise<APIResponse<unknown>> {
    return this.request<unknown>('/health');
  }
}

export const api = new ApiClient(API_URL);
