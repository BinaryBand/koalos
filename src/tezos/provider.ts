import { TezosOperationError, TezosToolkit } from '@taquito/taquito';
import {
  OperationContentsAndResult,
  RPCSimulateOperationParam,
  TezosGenericOperationError,
  RPCOptions,
  BlockResponse,
  BlockHeaderResponse,
  ConstantsResponse,
  ProtocolsResponse,
  ManagerKeyResponse,
  ContractResponse,
  EntrypointsResponse,
  StorageResponse,
  BigMapResponse,
  RunViewResult,
  PreapplyResponse,
} from '@taquito/rpc';

import { toExpr } from '@/tezos/encoders';
// import { assert } from '@/tools/utils';

import RPC_URLS from '@public/constants/rpc-providers.json';

// Create multiple Taquito instances for racing
function getTezosInstances(count: number = 2): TezosToolkit[] {
  const instances: TezosToolkit[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < Math.min(count, RPC_URLS.length); i++) {
    let randomIndex: number;
    do {
      randomIndex = Math.floor(Math.random() * RPC_URLS.length);
    } while (usedIndices.has(randomIndex));

    usedIndices.add(randomIndex);
    const instance = new TezosToolkit(RPC_URLS[randomIndex]!);
    instances.push(instance);
  }

  return instances;
}

async function raceRpcCalls<T>(
  rpcCall: (tezos: TezosToolkit) => Promise<T>,
  allowUndefined: boolean = false
): Promise<T> {
  const instances = getTezosInstances(2);

  const promises = instances.map(async (instance) => {
    const res = await rpcCall(instance);
    if (!allowUndefined && (res === undefined || res === null)) {
      throw new Error('Undefined result');
    }
    return res;
  });

  try {
    return await Promise.any(promises);
  } catch (e: unknown) {
    if (isAggregateError(e) && Array.isArray(e.errors) && e.errors.length) {
      throw e.errors[0];
    }
    throw new Error('All RPC calls failed');
  }
}

function isAggregateError(e: unknown): e is AggregateError {
  return typeof AggregateError !== 'undefined' && e instanceof AggregateError;
}

function isTezosGenericOperationError(error: unknown): error is TezosGenericOperationError[] {
  return (
    Array.isArray(error) &&
    error.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        'kind' in item &&
        typeof item.kind === 'string'
    )
  );
}

function handlePotentialOperationError(
  result: unknown,
  message: string,
  meta: OperationContentsAndResult[] = []
): void {
  if (isTezosGenericOperationError(result)) {
    throw new TezosOperationError(result, message, meta);
  }
}

import { LRUCache } from 'lru-cache';
export default class RpcProvider {
  // Value type {} excludes null/undefined (we never cache those), but allows primitives and objects
  private cache = new LRUCache<string, {}>({ max: 500, ttl: 1000 * 8 }); // Default TTL; per-call TTLs override

  public static singleton: RpcProvider = new RpcProvider();
  private pendingRequests = new Map<string, Promise<unknown>>();

  // Timing/caching helpers
  private readonly FALLBACK_BLOCK_TTL_MS = 8_000;
  private readonly FALLBACK_CYCLE_TTL_MS = 60 * 60 * 1000;
  private readonly IMMUTABLE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for non-head blocks
  private readonly CONSTANTS_SNAPSHOT_TTL_MS = 5 * 60 * 1000; // refresh protocol constants every 5 minutes
  private readonly HEAD_SNAPSHOT_TTL_MS = 1_000; // refresh head header snapshot every second

  private constantsSnapshot?: { constants: ConstantsResponse; fetchedAt: number };
  private headSnapshot?: { header: BlockHeaderResponse; fetchedAt: number };

  // Determine whether a block reference is volatile (changes with new head)
  // Volatile: undefined, 'head', 'head~N'
  // Immutable: block hash, numeric level (number or numeric string), 'genesis'
  private isVolatileBlockRef(block: RPCOptions['block'] | undefined): boolean {
    if (!block || block === 'head') return true;
    if (typeof block === 'string') {
      const s = block.toLowerCase();
      if (s.startsWith('head~')) return true;
      if (s === 'genesis') return false;
      if (/^B[0-9A-Za-z]{50,}$/.test(block)) return false; // likely block hash
      if (/^\d+$/.test(block)) return false; // numeric level as string
    }
    if (typeof block === 'number') return false; // numeric level
    return false; // default to immutable if unknown alias
  }

  // Fetch protocol constants with a short-lived snapshot to avoid heavy RPC usage
  private async getProtocolConstantsSnapshot(): Promise<ConstantsResponse> {
    const now = Date.now();
    if (this.constantsSnapshot && now - this.constantsSnapshot.fetchedAt < this.CONSTANTS_SNAPSHOT_TTL_MS) {
      return this.constantsSnapshot.constants;
    }
    const constants = await raceRpcCalls<ConstantsResponse>((tezos) => tezos.rpc.getConstants());
    this.constantsSnapshot = { constants, fetchedAt: now };
    return constants;
  }

  // Fetch head header with a very short-lived snapshot to avoid flooding RPC during bursts
  private async getHeadHeaderSnapshot(): Promise<BlockHeaderResponse> {
    const now = Date.now();
    if (this.headSnapshot && now - this.headSnapshot.fetchedAt < this.HEAD_SNAPSHOT_TTL_MS) {
      return this.headSnapshot.header;
    }
    const header = await raceRpcCalls<BlockHeaderResponse>((tezos) => tezos.rpc.getBlockHeader({ block: 'head' }));
    this.headSnapshot = { header, fetchedAt: now };
    return header;
  }

  // Compute TTLs dynamically from chain head and protocol constants.
  // - 'block': time remaining until the next block
  // - 'cycle': time remaining until the end of the current cycle
  // For non-head blocks (explicit level/hash), return a long TTL since data is immutable.
  private async calculateTtl(expirationType: 'block' | 'cycle', opts?: RPCOptions): Promise<number> {
    try {
      // Treat immutable references (hash/level/genesis) as long-lived; aliases like 'head' or 'head~N' are volatile
      if (!this.isVolatileBlockRef(opts?.block)) {
        return this.IMMUTABLE_TTL_MS;
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
        // Ensure a small positive TTL to avoid immediate eviction
        return Math.max(0, Math.min(blockDelayMs, timeLeftInCurrentBlock || 0));
      }

      // Cycle-based TTL
      const blocksPerCycle: number =
        typeof consts.blocks_per_cycle === 'number' ? consts.blocks_per_cycle : Number(consts.blocks_per_cycle ?? 4096);
      const level: number = typeof header.level === 'number' ? header.level : Number(header.level ?? 0);
      const cyclePosition: number = (((level - 1) % blocksPerCycle) + blocksPerCycle) % blocksPerCycle;

      const blocksRemainingIncludingCurrent = Math.max(1, blocksPerCycle - (cyclePosition ?? 0));
      const ttlMs = blocksRemainingIncludingCurrent * blockDelayMs - Math.min(elapsedInCurrentBlock, blockDelayMs);

      // Bound the TTL to reasonable limits and provide a fallback if something went wrong
      return Math.max(0, Math.min(ttlMs, 24 * 60 * 60 * 1000)); // cap at 24h
    } catch {
      // Safe fallbacks if RPC calls fail
      return expirationType === 'cycle' ? this.FALLBACK_CYCLE_TTL_MS : this.FALLBACK_BLOCK_TTL_MS;
    }
  }

  private buildKey(parts: unknown[]): string {
    return parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('|');
  }

  private getCachedValue<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    return (cached as T | undefined) ?? undefined;
  }

  private setCachedValue<T>(key: string, value: T, ttl: number): void {
    this.cache.set(key, value as {}, { ttl });
  }

  private async cached<T>(
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

  private async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number, errorMessage: string): Promise<T> {
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

  public async getChainId(): Promise<string> {
    const ttl = this.IMMUTABLE_TTL_MS; // Chain ID is immutable for a network
    return this.getOrFetch(
      'chainId',
      () => raceRpcCalls((tezos) => tezos.rpc.getChainId()),
      ttl,
      'Failed to get chain ID'
    );
  }

  public async getConstants(opts?: RPCOptions): Promise<ConstantsResponse> {
    return this.cached(
      'cycle',
      ['constants', opts?.block ?? 'head'],
      `Failed to get constants at block ${opts?.block ?? 'head'}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getConstants(opts)),
      opts
    );
  }

  public async getProtocols(opts?: RPCOptions): Promise<ProtocolsResponse> {
    return this.cached(
      'cycle',
      ['protocols', opts?.block ?? 'head'],
      `Failed to get protocols at block ${opts?.block ?? 'head'}`,
      async () => {
        // Prefer RPC /protocols; if unavailable, derive from full block
        const res = await raceRpcCalls<ProtocolsResponse>((tezos) => tezos.rpc.getProtocols(opts));
        if (res && typeof res.protocol === 'string') return res;
        const block = await raceRpcCalls<BlockResponse>((tezos) => tezos.rpc.getBlock(opts));
        const protocol: string = block.protocol;
        return { protocol, next_protocol: protocol };
      },
      opts
    );
  }

  public async getBlock(opts?: RPCOptions): Promise<BlockResponse> {
    return this.cached(
      'block',
      ['block', opts?.block ?? 'head'],
      `Failed to get block at ${opts?.block ?? 'head'}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getBlock(opts)),
      opts
    );
  }

  // Lightweight cached access to block header; used by getBlockHash to be more robust
  public async getBlockHeader(opts?: RPCOptions): Promise<BlockHeaderResponse> {
    return this.cached(
      'block',
      ['blockHeader', opts?.block ?? 'head'],
      `Failed to get block header at ${opts?.block ?? 'head'}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getBlockHeader(opts)),
      opts
    );
  }

  public async getBlockHash(opts?: RPCOptions): Promise<string> {
    return this.cached(
      'block',
      ['blockHash', opts?.block ?? 'head'],
      `Failed to get block hash at ${opts?.block ?? 'head'}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getBlockHash(opts)),
      opts
    );
  }

  public async getManagerKey(address: string, opts?: RPCOptions): Promise<ManagerKeyResponse | undefined> {
    return this.cached(
      'cycle',
      ['managerKey', address, opts?.block ?? 'head'],
      `Failed to get manager key for address ${address}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getManagerKey(address, opts), true),
      opts
    );
  }

  public async getContractResponse(address: string, opts?: RPCOptions): Promise<ContractResponse | undefined> {
    return this.cached(
      'block',
      ['contract', address, opts?.block ?? 'head'],
      `Failed to get contract ${address}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getContract(address, opts)),
      opts
    );
  }

  public async getScriptResponse(address: string, opts?: RPCOptions): Promise<ScriptResponse | undefined> {
    return this.getContractResponse(address, opts).then((contract) => contract?.script);
  }

  public async getStorageResponse(address: string, opts?: RPCOptions): Promise<StorageResponse | undefined> {
    return this.cached(
      'block',
      ['storage', address, opts?.block ?? 'head'],
      `Failed to get storage for contract ${address}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getStorage(address, opts)),
      opts
    );
  }

  public async getEntrypointsResponse(address: string, opts?: RPCOptions): Promise<EntrypointsResponse | undefined> {
    return this.cached(
      'block',
      ['entrypoints', address, opts?.block ?? 'head'],
      `Failed to get entrypoints for contract ${address}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getEntrypoints(address, opts)),
      opts
    );
  }

  public async getBigMapValue(id: string, key: Primitive, opts?: RPCOptions): Promise<BigMapResponse | undefined> {
    const expr: string = toExpr(key);
    return this.cached(
      'block',
      ['bigMap', id, expr, opts?.block ?? 'head'],
      `Failed to get big map value for id ${id} with key ${toExpr(key)}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getBigMapExpr(id, expr, opts).catch(() => undefined), true),
      opts
    );
  }

  public async runView(
    contract: string,
    entrypoint: string,
    input: MichelsonV1Expression,
    opts?: RPCOptions
  ): Promise<RunViewResult> {
    const chain_id: string = await this.getChainId();
    const expr: string = toExpr(JSON.stringify(input));
    return this.cached(
      'block',
      ['runView', contract, entrypoint, expr, opts?.block ?? 'head'],
      `Failed to run view on contract ${contract} with entrypoint ${entrypoint}`,
      () => raceRpcCalls((tezos) => tezos.rpc.runView({ contract, entrypoint, input, chain_id }, opts)),
      opts
    );
  }

  public async simulateOperation(operation: RPCSimulateOperationParam, opts?: RPCOptions): Promise<PreapplyResponse> {
    const simulation: PreapplyResponse = await raceRpcCalls((tezos) => tezos.rpc.simulateOperation(operation, opts));
    handlePotentialOperationError(simulation, `Failed simulation: ${JSON.stringify(operation, null, 2)}`);
    return simulation;
  }

  public async injectOperation(signedOperation: string): Promise<string> {
    const injectionResult: string = await raceRpcCalls((tezos) => tezos.rpc.injectOperation(signedOperation));
    handlePotentialOperationError(injectionResult, `Failed to inject operation: ${signedOperation}`);
    return injectionResult;
  }
}
