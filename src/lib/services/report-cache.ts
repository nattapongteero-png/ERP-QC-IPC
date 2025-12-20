/**
 * Report Cache Service
 * Implements caching for frequently accessed reports and data
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  lastAccessed: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  entries: Array<{
    key: string;
    hits: number;
    age: number;
    lastAccessed: number;
  }>;
}

// Cache configuration
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of entries
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

// In-memory caches
const templateCache = new Map<string, CacheEntry<unknown>>();
const dataCache = new Map<string, CacheEntry<unknown>>();

// Cache statistics
let cacheHits = 0;
let cacheMisses = 0;

// Cleanup interval reference
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Initialize cache cleanup interval
 */
export function initCacheCleanup(): void {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(() => {
    cleanupExpiredEntries(templateCache, DEFAULT_TTL);
    cleanupExpiredEntries(dataCache, DEFAULT_TTL);
  }, CLEANUP_INTERVAL);
}

/**
 * Stop cache cleanup interval
 */
export function stopCacheCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredEntries<T>(cache: Map<string, CacheEntry<T>>, ttl: number): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  cache.forEach((entry, key) => {
    if (now - entry.timestamp > ttl) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => cache.delete(key));

  // If cache is still too large, remove least recently used entries
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const entriesToRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
    entriesToRemove.forEach(([key]) => cache.delete(key));
  }
}

/**
 * Get item from template cache
 */
export function getTemplateFromCache<T>(key: string): T | null {
  const entry = templateCache.get(key);

  if (!entry) {
    cacheMisses++;
    return null;
  }

  // Check if expired
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    templateCache.delete(key);
    cacheMisses++;
    return null;
  }

  // Update access stats
  entry.hits++;
  entry.lastAccessed = Date.now();
  cacheHits++;

  return entry.data as T;
}

/**
 * Set item in template cache
 */
export function setTemplateInCache<T>(key: string, data: T): void {
  templateCache.set(key, {
    data,
    timestamp: Date.now(),
    hits: 0,
    lastAccessed: Date.now(),
  });

  // Trigger cleanup if cache is too large
  if (templateCache.size > MAX_CACHE_SIZE) {
    cleanupExpiredEntries(templateCache, DEFAULT_TTL);
  }
}

/**
 * Invalidate template cache entry
 */
export function invalidateTemplateCache(key: string): void {
  templateCache.delete(key);
}

/**
 * Get item from data cache (for report data)
 */
export function getDataFromCache<T>(key: string): T | null {
  const entry = dataCache.get(key);

  if (!entry) {
    cacheMisses++;
    return null;
  }

  // Check if expired (shorter TTL for data)
  const dataTTL = 2 * 60 * 1000; // 2 minutes for data
  if (Date.now() - entry.timestamp > dataTTL) {
    dataCache.delete(key);
    cacheMisses++;
    return null;
  }

  // Update access stats
  entry.hits++;
  entry.lastAccessed = Date.now();
  cacheHits++;

  return entry.data as T;
}

/**
 * Set item in data cache
 */
export function setDataInCache<T>(key: string, data: T): void {
  dataCache.set(key, {
    data,
    timestamp: Date.now(),
    hits: 0,
    lastAccessed: Date.now(),
  });

  // Trigger cleanup if cache is too large
  if (dataCache.size > MAX_CACHE_SIZE) {
    cleanupExpiredEntries(dataCache, DEFAULT_TTL);
  }
}

/**
 * Invalidate data cache entry
 */
export function invalidateDataCache(key: string): void {
  dataCache.delete(key);
}

/**
 * Invalidate all cache entries matching a pattern
 */
export function invalidateCacheByPattern(pattern: string): number {
  let count = 0;
  const regex = new RegExp(pattern);

  templateCache.forEach((_, key) => {
    if (regex.test(key)) {
      templateCache.delete(key);
      count++;
    }
  });

  dataCache.forEach((_, key) => {
    if (regex.test(key)) {
      dataCache.delete(key);
      count++;
    }
  });

  return count;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  templateCache.clear();
  dataCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const now = Date.now();
  const allEntries: Array<{ key: string; hits: number; age: number; lastAccessed: number }> = [];

  templateCache.forEach((entry, key) => {
    allEntries.push({
      key: `template:${key}`,
      hits: entry.hits,
      age: now - entry.timestamp,
      lastAccessed: now - entry.lastAccessed,
    });
  });

  dataCache.forEach((entry, key) => {
    allEntries.push({
      key: `data:${key}`,
      hits: entry.hits,
      age: now - entry.timestamp,
      lastAccessed: now - entry.lastAccessed,
    });
  });

  const totalRequests = cacheHits + cacheMisses;

  return {
    size: templateCache.size + dataCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
    entries: allEntries.sort((a, b) => b.hits - a.hits),
  };
}

/**
 * Generate cache key for report template
 */
export function getTemplateCacheKey(code: string): string {
  return `template:${code}`;
}

/**
 * Generate cache key for report data
 */
export function getDataCacheKey(
  endpoint: string,
  parameters?: Record<string, unknown>
): string {
  const paramStr = parameters ? JSON.stringify(parameters) : '';
  return `data:${endpoint}:${paramStr}`;
}

/**
 * Cached fetch for report templates
 */
export async function cachedFetchTemplate<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = getTemplateFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch and cache
  const data = await fetchFn();
  setTemplateInCache(key, data);
  return data;
}

/**
 * Cached fetch for report data
 */
export async function cachedFetchData<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = getDataFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch and cache
  const data = await fetchFn();
  setDataInCache(key, data);
  return data;
}

// Initialize cleanup on module load
if (typeof window === 'undefined') {
  // Server-side: initialize cleanup
  initCacheCleanup();
}
