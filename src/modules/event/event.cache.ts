/**
 * Production-ready in-memory TTL cache for Campus Events.
 * Bounded with maximum entries to prevent memory leaks and optimized for high read throughput.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class EventMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;
  private defaultTTLSeconds: number;

  constructor(maxEntries = 500, defaultTTLSeconds = 45) {
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
    // If over limit, evict the oldest entry
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

export const eventCache = new EventMemoryCache(500, 60); // 60s TTL
