interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  private maxEntries: number;
  private defaultTTL: number;

  constructor(maxEntries: number = 2000, defaultTTLSeconds: number = 60) {
    this.maxEntries = maxEntries;
    this.defaultTTL = defaultTTLSeconds * 1000;

    const interval = setInterval(() => this.pruneExpired(), 60000);
    if (interval.unref) {
      interval.unref();
    }
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (this.store.size >= this.maxEntries) {
      this.pruneOldest();
    }

    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTTL;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  del(key: string): void {
    this.store.delete(key);
    this.inFlight.delete(key);
  }

  delPattern(pattern: RegExp | string): void {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
    for (const key of this.inFlight.keys()) {
      if (regex.test(key)) {
        this.inFlight.delete(key);
      }
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = fetchFn()
      .then((fresh) => {
        if (this.inFlight.get(key) === promise) {
          this.set(key, fresh, ttlSeconds);
        }
        return fresh;
      })
      .finally(() => {
        if (this.inFlight.get(key) === promise) {
          this.inFlight.delete(key);
        }
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  private pruneOldest(): void {
    const firstKey = this.store.keys().next().value;
    if (firstKey) {
      this.store.delete(firstKey);
    }
  }
}

export const appCache = new MemoryCache();
