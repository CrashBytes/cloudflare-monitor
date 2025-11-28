import { z } from 'zod';

// Environment Configuration Schema
export const envSchema = z.object({
  CLOUDFLARE_API_TOKEN: z.string().min(1, 'Cloudflare API token is required'),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'Cloudflare account ID is required'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  CACHE_TTL_MS: z.coerce.number().int().positive().default(10000),
  DATABASE_PATH: z.string().default('./data/monitor.db'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // How long to show failed deployments on dashboard (in days)
  FAILURE_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Deployment Status Schema
export const deploymentStatusSchema = z.enum([
  'active',
  'building',
  'deploying',
  'failure',
  'queued',
  'cancelled',
]);

// Deployment Stage Schema
export const deploymentStageSchema = z.object({
  name: z.string(),
  status: z.enum(['idle', 'active', 'success', 'failure', 'skipped', 'cancelled']),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
});

// Cloudflare Project Schema
export const cloudflareProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountId: z.string(),
  createdAt: z.string(),
  production_branch: z.string().optional(),
});

// Cloudflare Deployment Schema
export const cloudflareDeploymentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  environment: z.enum(['production', 'preview']),
  url: z.string().url(),
  status: deploymentStatusSchema,
  createdAt: z.string(),
  modifiedAt: z.string(),
  latestStage: deploymentStageSchema.optional(),
  aliases: z.array(z.string()).optional(),
});

// Worker Schema
export const workerSchema = z.object({
  id: z.string(),
  name: z.string(),
  script: z.string(),
  createdOn: z.string(),
  modifiedOn: z.string(),
  etag: z.string(),
  routes: z.array(z.object({
    id: z.string(),
    pattern: z.string(),
    script: z.string(),
  })).optional(),
});

// Pagination Schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).default(25),
});

// API Response Schema
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    }).optional(),
    meta: z.object({
      page: z.number().optional(),
      per_page: z.number().optional(),
      total: z.number().optional(),
      timestamp: z.string(),
    }).optional(),
  });

// SSE Message Schema
export const sseMessageSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    event: z.string(),
    data: dataSchema,
    timestamp: z.string(),
  });

// Health Status Schema
export const healthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number(),
  services: z.object({
    database: z.enum(['operational', 'degraded', 'down']),
    cloudflare_api: z.enum(['operational', 'degraded', 'down']),
    polling: z.enum(['operational', 'degraded', 'down']),
  }),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
