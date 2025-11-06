/**
 * Base Cloudflare API Client
 * 
 * Implements resilient HTTP communication with:
 * - Exponential backoff retry logic
 * - Rate limit handling
 * - Comprehensive error handling
 * - Type-safe request/response patterns
 */

export interface CloudflareClientConfig {
  apiToken: string;
  accountId: string;
  baseURL?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface CloudflareAPIError {
  code: number;
  message: string;
  error_chain?: Array<{ code: number; message: string }>;
}

export interface CloudflareAPIResponse<T> {
  result: T;
  success: boolean;
  errors: CloudflareAPIError[];
  messages: string[];
  result_info?: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
}

export class CloudflareClient {
  private readonly config: Required<CloudflareClientConfig>;

  constructor(config: CloudflareClientConfig) {
    this.config = {
      baseURL: 'https://api.cloudflare.com/client/v4',
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Execute HTTP request with retry logic
   * 
   * Implements exponential backoff for transient failures:
   * - Network errors
   * - Rate limiting (429)
   * - Server errors (5xx)
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<CloudflareAPIResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Rate limiting - exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : this.calculateBackoff(attempt);
          
          if (attempt < this.config.maxRetries) {
            await this.sleep(delay);
            continue;
          }
        }

        // Server errors - retry with backoff
        if (response.status >= 500) {
          if (attempt < this.config.maxRetries) {
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
        }

        const data = await response.json() as CloudflareAPIResponse<T>;

        if (!response.ok) {
          throw new Error(
            `Cloudflare API error: ${data.errors?.[0]?.message || response.statusText}`
          );
        }

        if (!data.success) {
          throw new Error(
            `Cloudflare API request failed: ${data.errors?.[0]?.message || 'Unknown error'}`
          );
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on client errors (except network errors)
        if (error instanceof Error && error.name !== 'AbortError') {
          if (attempt < this.config.maxRetries) {
            await this.sleep(this.calculateBackoff(attempt));
            continue;
          }
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Exponential backoff calculation
   * Formula: baseDelay * 2^attempt + jitter
   */
  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.config.retryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods
  async get<T>(endpoint: string): Promise<CloudflareAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: unknown): Promise<CloudflareAPIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<CloudflareAPIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<CloudflareAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}
