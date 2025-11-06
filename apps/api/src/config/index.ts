/**
 * Configuration Management System
 * 
 * Implements robust environment validation with:
 * - Zod schema enforcement
 * - Fail-fast initialization
 * - Type-safe configuration access
 * 
 * Design Philosophy:
 * Configuration errors should be caught at startup, not at runtime.
 * This prevents partial system initialization with invalid state.
 */

import { envSchema, type EnvConfig } from '@cloudflare-monitor/shared';

/**
 * Load and validate environment configuration
 * 
 * @throws {Error} If required environment variables are missing or invalid
 * @returns {EnvConfig} Validated and type-safe configuration object
 */
export function loadConfig(): EnvConfig {
  try {
    // Parse and validate environment variables
    const config = envSchema.parse(process.env);
    
    // Log non-sensitive configuration for debugging
    if (config.NODE_ENV === 'development') {
      console.log('[Config] Environment:', config.NODE_ENV);
      console.log('[Config] API Port:', config.API_PORT);
      console.log('[Config] Poll Interval:', config.POLL_INTERVAL_MS, 'ms');
      console.log('[Config] Database:', config.DATABASE_PATH);
    }
    
    return config;
  } catch (error) {
    // Provide actionable error messages for configuration issues
    if (error instanceof Error) {
      console.error('❌ Configuration validation failed:');
      console.error(error.message);
      console.error('\n💡 Ensure all required environment variables are set.');
      console.error('   See .env.example for required configuration.');
    }
    
    // Fail fast - don't attempt to start with invalid configuration
    process.exit(1);
  }
}

/**
 * Global configuration instance
 * Initialized once at application startup
 */
export const config = loadConfig();

/**
 * Configuration validation helper
 * Useful for testing and health checks
 */
export function validateConfig(envVars: Record<string, unknown>): boolean {
  try {
    envSchema.parse(envVars);
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
