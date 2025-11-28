/**
 * Cache Service Tests
 * 
 * Unit tests for the LRU cache implementation.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { CacheService } from '../src/services/cache';

describe('CacheService', () => {
  let cache: CacheService<number>;

  beforeEach(() => {
    cache = new CacheService<number>(3, 1000); // maxSize: 3, ttl: 1000ms
  });

  test('set and get values', () => {
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  test('returns null for missing keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  test('has returns true for existing keys', () => {
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  test('delete removes values', () => {
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
    
    cache.delete('a');
    expect(cache.has('a')).toBe(false);
  });

  test('clear removes all values', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBeNull();
  });

  test('evicts oldest when max size exceeded', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    
    // Adding 4th item should evict oldest ('a')
    cache.set('d', 4);
    
    expect(cache.get('a')).toBeNull(); // 'a' should be evicted
    expect(cache.get('d')).toBe(4);
  });

  test('get refreshes item order (LRU behavior)', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    
    // Access 'a' to make it recently used
    cache.get('a');
    
    // Add new item - should evict 'b' (least recently used)
    cache.set('d', 4);
    
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeNull(); // 'b' should be evicted
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  test('expired items are not returned', async () => {
    const shortTtlCache = new CacheService<number>(10, 50); // 50ms TTL
    
    shortTtlCache.set('a', 1);
    expect(shortTtlCache.get('a')).toBe(1);
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(shortTtlCache.get('a')).toBeNull();
  });

  test('updating existing key does not increase eviction', () => {
    cache.set('a', 1);
    cache.set('a', 100);
    expect(cache.get('a')).toBe(100);
    
    // Should still have room for 2 more
    cache.set('b', 2);
    cache.set('c', 3);
    
    expect(cache.get('a')).toBe(100);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  test('handles complex objects', () => {
    const objectCache = new CacheService<{ id: number; name: string }>(10, 5000);
    
    const obj = { id: 1, name: 'test' };
    objectCache.set('obj', obj);
    
    const retrieved = objectCache.get('obj');
    expect(retrieved).toEqual(obj);
    expect(retrieved?.id).toBe(1);
    expect(retrieved?.name).toBe('test');
  });

  test('handles array values', () => {
    const arrayCache = new CacheService<number[]>(10, 5000);
    
    arrayCache.set('arr', [1, 2, 3]);
    
    const retrieved = arrayCache.get('arr');
    expect(retrieved).toEqual([1, 2, 3]);
    expect(retrieved?.length).toBe(3);
  });

  test('getStats returns cache statistics', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    
    cache.get('a'); // hit
    cache.get('a'); // hit
    cache.get('nonexistent'); // miss
    
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(3);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });

  test('getHealthStatus returns operational for good hit rate', () => {
    cache.set('a', 1);
    
    // Generate hits
    for (let i = 0; i < 10; i++) {
      cache.get('a');
    }
    
    expect(cache.getHealthStatus()).toBe('operational');
  });

  test('getHealthStatus returns degraded for medium hit rate', () => {
    cache.set('a', 1);
    
    // 3 hits, 7 misses = 30% hit rate
    for (let i = 0; i < 3; i++) {
      cache.get('a');
    }
    for (let i = 0; i < 7; i++) {
      cache.get(`miss-${i}`);
    }
    
    expect(cache.getHealthStatus()).toBe('degraded');
  });

  test('evictExpired removes stale entries', async () => {
    const shortTtlCache = new CacheService<number>(10, 50);
    
    shortTtlCache.set('a', 1);
    shortTtlCache.set('b', 2);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const evicted = shortTtlCache.evictExpired();
    expect(evicted).toBe(2);
  });
});

describe('CacheService edge cases', () => {
  test('handles empty cache operations', () => {
    const cache = new CacheService<number>(5, 1000);
    
    expect(cache.get('any')).toBeNull();
    expect(cache.has('any')).toBe(false);
    cache.delete('any'); // Should not throw
    cache.clear(); // Should not throw
  });

  test('handles maxSize of 1', () => {
    const cache = new CacheService<number>(1, 1000);
    
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    
    cache.set('b', 2);
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
  });

  test('handles very long TTL', () => {
    const cache = new CacheService<number>(5, 86400000); // 24 hours
    
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  test('initial health status is operational', () => {
    const cache = new CacheService<number>(5, 1000);
    expect(cache.getHealthStatus()).toBe('operational');
  });

  test('stats show correct hitRate format', () => {
    const cache = new CacheService<number>(5, 1000);
    cache.set('a', 1);
    cache.get('a');
    cache.get('miss');
    
    const stats = cache.getStats();
    expect(stats.hitRate).toMatch(/^\d+\.\d+%$/);
  });
});
