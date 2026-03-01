import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheConfig {
  enabled: boolean;
  defaultTTL: number;
  maxSize: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  enabled: true,
  defaultTTL: 30000,
  maxSize: 1000,
};

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, evictions: 0 };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + (ttl || this.config.defaultTTL),
    };

    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry as CacheEntry<unknown>);
    this.stats.sets++;
  }

  get<T>(key: string): T | null {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = key;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
      this.stats.evictions++;
    }
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getSize(): number {
    return this.cache.size;
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

let cacheInstance: MemoryCache | null = null;

export function getCache(config?: Partial<CacheConfig>): MemoryCache {
  if (!cacheInstance) {
    cacheInstance = new MemoryCache(config);
  }
  return cacheInstance;
}

export function createCache(config?: Partial<CacheConfig>): MemoryCache {
  return new MemoryCache(config);
}

export function clearCache(): void {
  if (cacheInstance) {
    cacheInstance.clear();
  }
}

export function getCacheStats(): CacheStats {
  return cacheInstance?.getStats() || { hits: 0, misses: 0, sets: 0, evictions: 0 };
}

const cachedFetchCache = new MemoryCache({ defaultTTL: 60000, maxSize: 50 });

export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
  const cached = cachedFetchCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  cachedFetchCache.set(key, data, ttl);
  return data;
}

export interface MarketCacheData {
  markets: unknown[];
  lastUpdated: number;
}

const marketCache = new MemoryCache({ defaultTTL: 30000, maxSize: 10 });

export function cacheMarketData(markets: unknown[]): void {
  const data: MarketCacheData = { markets, lastUpdated: Date.now() };
  marketCache.set("markets", data);
}

export function getCachedMarketData(): MarketCacheData | null {
  return marketCache.get<MarketCacheData>("markets");
}

export function invalidateMarketCache(): void {
  marketCache.delete("markets");
}
