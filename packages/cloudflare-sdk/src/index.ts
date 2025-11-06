/**
 * Cloudflare SDK Entry Point
 * 
 * Unified interface for Cloudflare API operations
 * Implements the Facade pattern to simplify complex subsystem interactions
 */

import { CloudflareClient, type CloudflareClientConfig } from './client';
import { PagesResource } from './resources/pages';
import { WorkersResource } from './resources/workers';

export * from './client';
export * from './resources/pages';
export * from './resources/workers';

/**
 * Main SDK class providing unified access to Cloudflare resources
 * 
 * Design principles:
 * - Resource-based organization matching Cloudflare's API structure
 * - Lazy initialization of resource handlers
 * - Shared client configuration across resources
 */
export class CloudflareSDK {
  private client: CloudflareClient;
  public readonly pages: PagesResource;
  public readonly workers: WorkersResource;

  constructor(config: CloudflareClientConfig) {
    this.client = new CloudflareClient(config);
    
    // Initialize resource handlers with shared client
    this.pages = new PagesResource(this.client, config.accountId);
    this.workers = new WorkersResource(this.client, config.accountId);
  }

  /**
   * Test API connectivity and authentication
   * Useful for health checks and initialization validation
   */
  async verifyToken(): Promise<boolean> {
    try {
      await this.client.get('/user/tokens/verify');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get account details
   * Validates account access and retrieves metadata
   */
  async getAccount() {
    return this.client.get(`/accounts/${this.client['config'].accountId}`);
  }
}
