/**
 * API Client Service
 * 
 * Centralized HTTP communication layer with error handling and type safety.
 */

import type { APIResponse, CloudflareProject, CloudflareDeployment } from '@cloudflare-monitor/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class APIClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<APIResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async getProjects(): Promise<CloudflareProject[]> {
    const response = await this.request<CloudflareProject[]>('/api/projects');
    return response.data || [];
  }

  async getProject(id: string): Promise<CloudflareProject | null> {
    const response = await this.request<CloudflareProject>(`/api/projects/${id}`);
    return response.data || null;
  }

  async getProjectDeployments(id: string): Promise<CloudflareDeployment[]> {
    const response = await this.request<CloudflareDeployment[]>(`/api/projects/${id}/deployments`);
    return response.data || [];
  }

  async getDeployments(): Promise<CloudflareDeployment[]> {
    const response = await this.request<CloudflareDeployment[]>('/api/deployments');
    return response.data || [];
  }

  async getDeployment(id: string): Promise<CloudflareDeployment | null> {
    const response = await this.request<CloudflareDeployment>(`/api/deployments/${id}`);
    return response.data || null;
  }

  async getProjectStats(): Promise<any> {
    const response = await this.request<any>('/api/projects/stats/summary');
    return response.data || {};
  }

  async getDeploymentStats(): Promise<any> {
    const response = await this.request<any>('/api/deployments/stats/summary');
    return response.data || {};
  }

  async getHealth(): Promise<any> {
    const response = await this.request<any>('/health');
    return response;
  }
}

export const apiClient = new APIClient();
