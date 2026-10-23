/**
 * Production-grade bounded in-memory TTL cache for Campus Notices.
 * Optimized for high-throughput reads across all student/teacher/admin queries
 * with automatic LRU-style eviction and instant invalidation on mutations.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class NoticeMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;
  private defaultTTLSeconds: number;

  constructor(maxEntries = 500, defaultTTLSeconds = 60) {
    this.maxEntries = maxEntries;
    this.defaultTTLSeconds = defaultTTLSeconds;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    // Evict oldest entry if maximum capacity is reached
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const ttl = (ttlSeconds ?? this.defaultTTLSeconds) * 1000;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }
}

export const noticeCache = new NoticeMemoryCache(500, 60);
