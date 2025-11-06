// Core domain models for Cloudflare monitoring

export interface CloudflareProject {
  id: string;
  name: string;
  accountId: string;
  createdAt: string;
  production_branch?: string;
}

export interface CloudflareDeployment {
  id: string;
  projectId: string;
  projectName: string;
  environment: 'production' | 'preview';
  url: string;
  status: DeploymentStatus;
  createdAt: string;
  modifiedAt: string;
  latestStage?: DeploymentStage;
  aliases?: string[];
}

export type DeploymentStatus = 
  | 'active'
  | 'building'
  | 'deploying'
  | 'failure'
  | 'queued'
  | 'cancelled';

export interface DeploymentStage {
  name: string;
  status: 'idle' | 'active' | 'success' | 'failure' | 'skipped' | 'cancelled';
  startedAt?: string;
  endedAt?: string;
}

export interface Worker {
  id: string;
  name: string;
  script: string;
  createdOn: string;
  modifiedOn: string;
  etag: string;
  routes?: WorkerRoute[];
}

export interface WorkerRoute {
  id: string;
  pattern: string;
  script: string;
}

export interface MonitoringMetrics {
  timestamp: string;
  totalProjects: number;
  totalDeployments: number;
  activeDeployments: number;
  buildingDeployments: number;
  failedDeployments: number;
}

export interface SSEMessage<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
}

// API Response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: ResponseMeta;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  per_page?: number;
  total?: number;
  timestamp: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  per_page?: number;
}

// Health check
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: 'operational' | 'degraded' | 'down';
    cloudflare_api: 'operational' | 'degraded' | 'down';
    polling: 'operational' | 'degraded' | 'down';
  };
}
