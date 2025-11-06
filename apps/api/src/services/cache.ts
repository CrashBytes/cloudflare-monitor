/**
 * 🛡️ LRU Cache Service
 * 
 * Implements an in-memory Least Recently Used (LRU) cache to reduce database load
 * and improve API response times for frequently accessed data.
 * 
 * ## Cache Design Rationale
 * 
 * **Why LRU?**
 * - Predictable memory footprint (bounded size)
 * - Automatic eviction of cold data
 * - O(1) get/set operations
 * - Simple mental model for reasoning about behavior
 * 
 * **Trade-offs:**
 * - Stale data risk (mitigated with TTL)
 * - Memory overhead (acceptable for monitoring workload)
 * - No persistence (acceptable for ephemeral data)
 * 
 * ## Performance Characteristics
 * 
 * - **Get**: O(1) average case
 * - **Set**: O(1) average case
 * - **Memory**: O(n) where n = maxSize
 * 
 * ## Use Cases
 * 
 * Ideal for:
 * - Deployment status queries (high read frequency)
 * - Project metadata (low change rate)
 * - Metrics aggregations (computed values)
 * 
 * Avoid for:
 * - User session data (requires persistence)
 * - Critical financial data (no staleness tolerance)
 * - Large binary blobs (memory constraints)
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

export class CacheService<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttl: number;
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Initialize cache with bounded size and TTL
   * 
   * @param maxSize Maximum number of entries (default: 100)
   * @param ttl Time-to-live in milliseconds (default: 10000ms)
   */
  constructor(maxSize: number = 100, ttl: number = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Retrieve value from cache
   * 
   * **Cache Hit:** Returns cached value and updates LRU ordering
   * **Cache Miss:** Returns null and increments miss counter
   * **Stale Entry:** Returns null and removes expired entry
   * 
   * @param key Cache key
   * @returns Cached value or null
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL expiration
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update LRU ordering (move to end)
    this.cache.delete(key);
    this.cache.set(key, {
      ...entry,
      accessCount: entry.accessCount + 1,
    });

    this.hits++;
    return entry.value;
  }

  /**
   * Store value in cache
   * 
   * Implements LRU eviction when cache is full:
   * - Removes oldest entry (first in Map iteration order)
   * - Inserts new entry at the end
   * 
   * @param key Cache key
   * @param value Value to cache
   */
  set(key: string, value: T): void {
    // Remove existing entry to update LRU position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict LRU entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Insert new entry (at end of Map)
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  /**
   * Remove entry from cache
   * 
   * @param key Cache key to invalidate
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists and is not expired
   * 
   * @param key Cache key
   * @returns true if key exists and is fresh
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   * 
   * Use sparingly - prefer targeted invalidation when possible.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics for monitoring
   * 
   * Useful for:
   * - Performance tuning (adjust maxSize/TTL based on hit rate)
   * - Capacity planning (monitor size vs maxSize)
   * - Debugging (identify hot keys via access patterns)
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(2) + '%',
      ttl: this.ttl,
    };
  }

  /**
   * Get cache health status
   * 
   * Determines operational status based on hit rate:
   * - operational: > 50% hit rate
   * - degraded: 20-50% hit rate
   * - down: < 20% hit rate (cache not effective)
   */
  getHealthStatus(): 'operational' | 'degraded' | 'down' {
    const totalRequests = this.hits + this.misses;
    if (totalRequests === 0) return 'operational'; // No requests yet

    const hitRate = (this.hits / totalRequests) * 100;

    if (hitRate > 50) return 'operational';
    if (hitRate > 20) return 'degraded';
    return 'down';
  }

  /**
   * Remove expired entries (manual cleanup)
   * 
   * Automatically called during get() operations, but can be
   * invoked manually for proactive memory management.
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        evicted++;
      }
    }

    return evicted;
  }
}

/**
 * Global cache instances for common use cases
 * 
 * Instantiated with sensible defaults for monitoring workloads:
 * - Deployments: Larger cache, shorter TTL (frequently changing)
 * - Projects: Smaller cache, longer TTL (infrequently changing)
 */
export const deploymentsCache = new CacheService<unknown>(200, 5000);  // 5s TTL
export const projectsCache = new CacheService<unknown>(50, 30000);     // 30s TTL
export const metricsCache = new CacheService<unknown>(20, 10000);      // 10s TTL
