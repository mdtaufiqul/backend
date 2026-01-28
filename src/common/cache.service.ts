import { Injectable, Logger } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);
    private readonly cache: LRUCache<string, any>;

    constructor() {
        this.cache = new LRUCache<string, any>({
            max: 1000,
            ttl: 1000 * 60 * 60, // 1 hour default TTL
        });
    }

    /**
     * Coalesced fetch: ensures multiple concurrent calls with the same key
     * result in only one execution of the fetcher function.
     */
    async coalescedFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttl?: number
    ): Promise<T> {
        const cached = this.cache.get(key);
        if (cached !== undefined) {
            // If it's a promise, it's an in-flight request (coalescing)
            if (cached instanceof Promise) {
                this.logger.debug(`Coalescing request for key: ${key}`);
                return cached;
            }
            // If it's a value, return it
            return cached as T;
        }

        // Create and store the promise to coalesce concurrent requests
        const promise = fetcher()
            .then((result) => {
                // Once resolved, replace the promise with the actual value
                this.cache.set(key, result, { ttl });
                return result;
            })
            .catch((error) => {
                // If it fails, remove the promise so next attempt can retry
                this.cache.delete(key);
                throw error;
            });

        this.cache.set(key, promise, { ttl: 1000 * 60 * 5 }); // Temp TTL for in-flight (5 mins)
        return promise;
    }

    get<T>(key: string): T | undefined {
        return this.cache.get(key) as T;
    }

    set<T>(key: string, value: T, ttl?: number): void {
        this.cache.set(key, value, { ttl });
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}
