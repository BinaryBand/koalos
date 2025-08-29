import { LRUCache } from 'lru-cache';
import { RPCOptions, BlockHeaderResponse, ConstantsResponse } from '@taquito/rpc';
import { isVolatileBlockRef } from '@/tezos/provider/block-utils';
import { raceRpcCalls } from '@/tezos/provider/rpc-racing';
import { handlePotentialOperationError } from '@/tezos/provider/error-handling';

export interface CacheConfig {
  maxSize: number;
  defaultTtlMs: number;
  immutableTtlMs: number;
  constantsSnapshotTtlMs: number;
  headSnapshotTtlMs: number;
  fallbackBlockTtlMs: number;
  fallbackCycleTtlMs: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 500,
  defaultTtlMs: 8000,
  immutableTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  constantsSnapshotTtlMs: 5 * 60 * 1000, // 5 minutes
  headSnapshotTtlMs: 1000, // 1 second
  fallbackBlockTtlMs: 8000,
  fallbackCycleTtlMs: 60 * 60 * 1000, // 1 hour
};

export class CacheManager {
  private cache = new LRUCache<string, {}>({ max: this.config.maxSize, ttl: this.config.defaultTtlMs });
  private pendingRequests = new Map<string, Promise<unknown>>();
  private constantsSnapshot?: { constants: ConstantsResponse; fetchedAt: number } | undefined;
  private headSnapshot?: { header: BlockHeaderResponse; fetchedAt: number } | undefined;

  constructor(private config: CacheConfig = DEFAULT_CACHE_CONFIG) {}

  /**
   * Builds a cache key from multiple parts
   */
  buildKey(parts: unknown[]): string {
    return parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('|');
  }

  /**
   * Gets a cached value
   */
  getCachedValue<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    return (cached as T | undefined) ?? undefined;
  }

  /**
   * Sets a cached value with TTL
   */
  setCachedValue<T>(key: string, value: T, ttl: number): void {
    this.cache.set(key, value as {}, { ttl });
  }

  /**
   * Fetches protocol constants with a short-lived snapshot to avoid heavy RPC usage
   */
  async getProtocolConstantsSnapshot(): Promise<ConstantsResponse> {
    const now = Date.now();
    if (this.constantsSnapshot && now - this.constantsSnapshot.fetchedAt < this.config.constantsSnapshotTtlMs) {
      return this.constantsSnapshot.constants;
    }
    const constants = await raceRpcCalls<ConstantsResponse>((tezos) => tezos.rpc.getConstants());
    this.constantsSnapshot = { constants, fetchedAt: now };
    return constants;
  }

  /**
   * Fetches head header with a very short-lived snapshot to avoid flooding RPC during bursts
   */
  async getHeadHeaderSnapshot(): Promise<BlockHeaderResponse> {
    const now = Date.now();
    if (this.headSnapshot && now - this.headSnapshot.fetchedAt < this.config.headSnapshotTtlMs) {
      return this.headSnapshot.header;
    }
    const header = await raceRpcCalls<BlockHeaderResponse>((tezos) => tezos.rpc.getBlockHeader({ block: 'head' }));
    this.headSnapshot = { header, fetchedAt: now };
    return header;
  }

  /**
   * Computes TTLs dynamically from chain head and protocol constants
   */
  async calculateTtl(expirationType: 'block' | 'cycle', opts?: RPCOptions): Promise<number> {
    try {
      // Treat immutable references (hash/level/genesis) as long-lived
      if (!isVolatileBlockRef(opts?.block)) {
        return this.config.immutableTtlMs;
      }

      const [header, constants] = await Promise.all([
        this.getHeadHeaderSnapshot(),
        this.getProtocolConstantsSnapshot(),
      ]);

      // Determine minimal block delay (seconds) across protocol versions
      const consts = constants as unknown as {
        minimal_block_delay?: string | number;
        time_between_blocks?: (string | number)[];
        blocks_per_cycle?: number | string;
      };

      const minimalBlockDelaySec: number =
        (typeof consts.minimal_block_delay === 'string' || typeof consts.minimal_block_delay === 'number'
          ? Number(consts.minimal_block_delay)
          : Array.isArray(consts.time_between_blocks)
          ? Number(consts.time_between_blocks[0])
          : undefined) ?? 8;
      const blockDelayMs = minimalBlockDelaySec * 1000;

      const headTimestampMs = new Date(header.timestamp).getTime();
      const now = Date.now();
      const elapsedInCurrentBlock = Math.max(0, now - headTimestampMs);
      const timeLeftInCurrentBlock = Math.max(0, blockDelayMs - elapsedInCurrentBlock);

      if (expirationType === 'block') {
        return Math.max(0, Math.min(blockDelayMs, timeLeftInCurrentBlock || 0));
      }

      // Cycle-based TTL
      const blocksPerCycle: number =
        typeof consts.blocks_per_cycle === 'number' ? consts.blocks_per_cycle : Number(consts.blocks_per_cycle ?? 4096);
      const level: number = typeof header.level === 'number' ? header.level : Number(header.level ?? 0);
      const cyclePosition: number = (((level - 1) % blocksPerCycle) + blocksPerCycle) % blocksPerCycle;

      const blocksRemainingIncludingCurrent = Math.max(1, blocksPerCycle - (cyclePosition ?? 0));
      const ttlMs = blocksRemainingIncludingCurrent * blockDelayMs - Math.min(elapsedInCurrentBlock, blockDelayMs);

      // Bound the TTL to reasonable limits
      return Math.max(0, Math.min(ttlMs, 24 * 60 * 60 * 1000)); // cap at 24h
    } catch {
      // Safe fallbacks if RPC calls fail
      return expirationType === 'cycle' ? this.config.fallbackCycleTtlMs : this.config.fallbackBlockTtlMs;
    }
  }

  /**
   * Gets or fetches a value with request coalescing and caching
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number, errorMessage: string): Promise<T> {
    // Fast path: cache hit
    const cached = this.getCachedValue<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Coalesce concurrent fetches
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const request = (async () => {
      try {
        const result = await fetcher();
        handlePotentialOperationError(result, errorMessage);
        if (result !== undefined && result !== null) {
          this.setCachedValue<T>(key, result, ttl);
        }
        return result;
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, request as Promise<unknown>);
    return request;
  }

  /**
   * Cached operation with dynamic TTL calculation
   */
  async cached<T>(
    ttlType: 'block' | 'cycle',
    keyParts: unknown[],
    errorMessage: string,
    fetcher: () => Promise<T>,
    opts?: RPCOptions
  ): Promise<T> {
    const ttl = await this.calculateTtl(ttlType, opts);
    const key = this.buildKey(keyParts);
    return this.getOrFetch(key, fetcher, ttl, errorMessage);
  }

  /**
   * Clears all cached data
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    delete this.constantsSnapshot;
    delete this.headSnapshot;
  }

  /**
   * Gets cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      pendingRequests: this.pendingRequests.size,
      hasConstantsSnapshot: !!this.constantsSnapshot,
      hasHeadSnapshot: !!this.headSnapshot,
    };
  }
}
