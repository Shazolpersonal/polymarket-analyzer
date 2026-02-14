/**
 * Simple in-memory TTL cache to reduce redundant API calls.
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

class MemoryCache {
    private store = new Map<string, CacheEntry<unknown>>();

    get<T>(key: string): T | null {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T, ttlMs: number): void {
        this.store.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
        });
    }

    clear(): void {
        this.store.clear();
    }
}

// Singleton cache instance
export const cache = new MemoryCache();

// TTL constants
export const CACHE_TTL = {
    MARKET_DATA: 30 * 60 * 1000,   // 30 minutes
    HOLDER_DATA: 10 * 60 * 1000,   // 10 minutes
    USER_PROFILE: 10 * 60 * 1000,  // 10 minutes
    PRICE_DATA: 2 * 60 * 1000,     // 2 minutes
} as const;
