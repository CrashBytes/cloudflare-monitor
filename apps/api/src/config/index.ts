/**
 * Configuration Management System
 *
 * Uses @crashbytes/env-shield for type-safe environment validation
 * with fail-fast initialization at startup.
 */

import { createEnv, s } from '@crashbytes/env-shield';

/**
 * Validated and type-safe configuration object
 */
export const config = createEnv({
  schema: {
    CLOUDFLARE_API_TOKEN: s.string().min(1),
    CLOUDFLARE_ACCOUNT_ID: s.string().min(1),
    API_PORT: s.port().default(3001),
    API_HOST: s.string().default('0.0.0.0'),
    NODE_ENV: s.enum('development', 'production', 'test').default('development'),
    POLL_INTERVAL_MS: s.number().int().default(5000),
    CACHE_TTL_MS: s.number().int().default(10000),
    DATABASE_PATH: s.string().default('./data/monitor.db'),
    CORS_ORIGIN: s.url().default('http://localhost:5173'),
    LOG_LEVEL: s.enum('debug', 'info', 'warn', 'error').default('info'),
    FAILURE_RETENTION_DAYS: s.number().int().default(7),
  },
});

export type EnvConfig = typeof config;

/**
 * Configuration validation helper
 * Useful for testing and health checks
 */
export function validateConfig(envVars: Record<string, unknown>): boolean {
  try {
    createEnv({
      schema: {
        CLOUDFLARE_API_TOKEN: s.string().min(1),
        CLOUDFLARE_ACCOUNT_ID: s.string().min(1),
      },
      source: envVars as Record<string, string>,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get sanitized configuration for logging
 * Removes sensitive values (API tokens, secrets)
 */
export function getSanitizedConfig(): Omit<EnvConfig, 'CLOUDFLARE_API_TOKEN'> {
  const { CLOUDFLARE_API_TOKEN, ...sanitized } = config;
  return sanitized;
}
