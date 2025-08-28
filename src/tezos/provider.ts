import { TezosOperationError, TezosToolkit } from '@taquito/taquito';
import { OperationContentsAndResult, RPCSimulateOperationParam, TezosGenericOperationError } from '@taquito/rpc';

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

// Race multiple RPC calls and return the fastest
async function raceRpcCalls<T>(rpcCall: (tezos: TezosToolkit) => Promise<T>): Promise<T> {
  const instances = getTezosInstances(2);

  const promises = instances.map(async (instance, index) => {
    try {
      const result = await rpcCall(instance);
      return { result, index, success: true };
    } catch (error) {
      return { error, index, success: false };
    }
  });

  // Race all promises
  const results = await Promise.allSettled(promises);

  // Find the first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      return result.value.result as T;
    }
  }

  // If no successful results, throw the first error
  for (const result of results) {
    if (result.status === 'fulfilled' && !result.value.success) {
      throw result.value.error;
    }
  }

  // If all promises were rejected, throw a generic error
  throw new Error('All RPC calls failed');
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
import { Mutex, MutexInterface } from 'async-mutex';
export default class RpcProvider {
  private cache = new LRUCache({ max: 500, ttl: 1000 * 8 }); // 1 block delay
  private mutex: Mutex = new Mutex();
  private pendingRequests = new Map<string, Promise<any>>();

  public static singleton: RpcProvider = new RpcProvider();

  private getCachedValue<T>(key: string): T | undefined {
    const cachedEntry: unknown = this.cache.get(key);
    if (cachedEntry !== undefined) {
      return cachedEntry as T;
    }
    return undefined;
  }

  private async setCachedValue<T extends {}>(key: string, value: T, ttl: number): Promise<void> {
    const release: MutexInterface.Releaser = await this.mutex.acquire();
    try {
      this.cache.set(key, value, { ttl });
    } finally {
      release();
    }
  }

  private async calculateTtl(expirationType: 'block' | 'cycle'): Promise<number> {
    // Use simple fixed TTLs to avoid circular dependencies
    if (expirationType === 'cycle') {
      return 1000 * 60 * 60; // 1 hour for cycle-based data
    } else {
      return 1000 * 8; // 8 seconds for block-based data
    }
  }

  private async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number, errorMessage: string): Promise<T> {
    // Check cache first
    const cached = this.getCachedValue<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    // Create new request
    const request = this.fetchAndCache(key, fetcher, ttl, errorMessage);
    this.pendingRequests.set(key, request);

    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    errorMessage: string
  ): Promise<T> {
    try {
      const result = await fetcher();
      handlePotentialOperationError(result, errorMessage);
      if (result !== null && result !== undefined) {
        await this.setCachedValue(key, result as T & {}, ttl);
      }
      return result;
    } catch (error) {
      handlePotentialOperationError(error, errorMessage);
      throw error;
    }
  }

  public async getChainId(): Promise<string> {
    const ttl = await this.calculateTtl('cycle');
    return this.getOrFetch(
      'chainId',
      () => raceRpcCalls((tezos) => tezos.rpc.getChainId()),
      ttl,
      'Failed to get chain ID'
    );
  }

  public async getConstants(opts?: RPCOptions): Promise<ConstantsResponse> {
    const constantsCacheKey: string = `constants_${opts?.block ?? 'head'}`;
    const ttl = 100000; // Long TTL for constants
    return this.getOrFetch(
      constantsCacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.getConstants(opts)),
      ttl,
      `Failed to get constants at block ${opts?.block ?? 'head'}`
    );
  }

  public async getProtocols(opts?: RPCOptions): Promise<ProtocolsResponse> {
    const cacheKey: string = `protocols_${opts?.block ?? 'head'}`;
    const ttl = await this.calculateTtl('cycle');
    return this.getOrFetch(
      cacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.getProtocols(opts)),
      ttl,
      `Failed to get protocols at block ${opts?.block ?? 'head'}`
    );
  }

  public async getBlock(opts?: RPCOptions): Promise<BlockResponse> {
    const cacheKey: string = `block_${opts?.block ?? 'head'}`;
    const ttl = await this.calculateTtl('block');
    return this.getOrFetch(
      cacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.getBlock(opts)),
      ttl,
      `Failed to get block at ${opts?.block ?? 'head'}`
    );
  }

  public async getBlockHash(opts?: RPCOptions): Promise<string> {
    return this.getBlock(opts).then((block) => block.hash);
  }

  public async getManagerKey(address: string, opts?: RPCOptions): Promise<ManagerKeyResponse | undefined> {
    const cacheKey: string = `managerKey_${address}_${opts?.block ?? 'head'}`;
    const ttl = await this.calculateTtl('cycle');
    return this.getOrFetch(
      cacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.getManagerKey(address, opts)),
      ttl,
      `Failed to get manager key for address ${address}`
    );
  }

  public async getContractResponse(address: string, opts?: RPCOptions): Promise<ContractResponse | undefined> {
    const cacheKey: string = `contract_${address}_${opts?.block ?? 'head'}`;
    const ttl = await this.calculateTtl('block');
    return this.getOrFetch(
      cacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.getContract(address, opts)),
      ttl,
      `Failed to get contract ${address}`
    );
  }

  public async getScriptResponse(address: string, opts?: RPCOptions): Promise<ScriptResponse | undefined> {
    return this.getContractResponse(address, opts).then((contract) => contract?.script);
  }

  public async getStorageResponse(address: string, opts?: RPCOptions): Promise<StorageResponse | undefined> {
    const cacheKey: string = `storage_${address}_${opts?.block ?? 'head'}`;
    const ttl = await this.calculateTtl('block');
    return this.getOrFetch(
      cacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.getStorage(address, opts)),
      ttl,
      `Failed to get storage for contract ${address}`
    );
  }

  public async getEntrypointsResponse(address: string, opts?: RPCOptions): Promise<EntrypointsResponse | undefined> {
    const cacheKey: string = `entrypoints_${address}_${opts?.block ?? 'head'}`;
    const ttl = await this.calculateTtl('block');
    return this.getOrFetch(
      cacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.getEntrypoints(address, opts)),
      ttl,
      `Failed to get entrypoints for contract ${address}`
    );
  }

  public async getBigMapValue(id: string, key: Primitive, opts?: RPCOptions): Promise<BigMapResponse | undefined> {
    const expr: string = toExpr(key);
    const cacheKey: string = `bigMap_${id}_${expr}_${opts?.block ?? 'head'}`;
    const ttl = await this.calculateTtl('block');

    return this.getOrFetch(
      cacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.getBigMapExpr(id, expr, opts).catch(() => undefined)),
      ttl,
      `Failed to get big map value for id ${id} with key ${toExpr(key)}`
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
    const cacheKey: string = `runView_${contract}_${entrypoint}_${expr}_${opts?.block ?? 'head'}`;
    const ttl = await this.calculateTtl('block');

    return this.getOrFetch(
      cacheKey,
      () => raceRpcCalls((tezos) => tezos.rpc.runView({ contract, entrypoint, input, chain_id }, opts)),
      ttl,
      `Failed to run view on contract ${contract} with entrypoint ${entrypoint}`
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
