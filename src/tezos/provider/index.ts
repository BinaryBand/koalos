import {
  RPCSimulateOperationParam,
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
  ScriptResponse,
} from '@taquito/rpc';

import { toExpr } from '@/tezos/encoders';
import { raceRpcCalls } from '@/tezos/provider/rpc-racing';
import { handlePotentialOperationError } from '@/tezos/provider/error-handling';
import { normalizeBlockRef } from '@/tezos/provider/block-utils';
import { CacheManager, DEFAULT_CACHE_CONFIG } from '@/tezos/provider/cache-manager';

// Re-export types that consumers might need
export type { CacheConfig } from '@/tezos/provider/cache-manager';

/**
 * RPC Provider with intelligent caching, request racing, and error handling
 */
export default class RpcProvider {
  private cacheManager = new CacheManager(DEFAULT_CACHE_CONFIG);

  public static singleton: RpcProvider = new RpcProvider();

  // Chain-level operations
  public async getChainId(): Promise<string> {
    const ttl = this.cacheManager['config'].immutableTtlMs; // Chain ID is immutable for a network
    return this.cacheManager.getOrFetch(
      'chainId',
      () => raceRpcCalls((tezos) => tezos.rpc.getChainId()),
      ttl,
      'Failed to get chain ID'
    );
  }

  public async getConstants(opts?: RPCOptions): Promise<ConstantsResponse> {
    return this.cacheManager.cached(
      'cycle',
      ['constants', normalizeBlockRef(opts?.block)],
      `Failed to get constants at block ${normalizeBlockRef(opts?.block)}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getConstants(opts)),
      opts
    );
  }

  public async getProtocols(opts?: RPCOptions): Promise<ProtocolsResponse> {
    return this.cacheManager.cached(
      'cycle',
      ['protocols', normalizeBlockRef(opts?.block)],
      `Failed to get protocols at block ${normalizeBlockRef(opts?.block)}`,
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

  // Block operations
  public async getBlock(opts?: RPCOptions): Promise<BlockResponse> {
    return this.cacheManager.cached(
      'block',
      ['block', normalizeBlockRef(opts?.block)],
      `Failed to get block at ${normalizeBlockRef(opts?.block)}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getBlock(opts)),
      opts
    );
  }

  public async getBlockHeader(opts?: RPCOptions): Promise<BlockHeaderResponse> {
    return this.cacheManager.cached(
      'block',
      ['blockHeader', normalizeBlockRef(opts?.block)],
      `Failed to get block header at ${normalizeBlockRef(opts?.block)}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getBlockHeader(opts)),
      opts
    );
  }

  public async getBlockHash(opts?: RPCOptions): Promise<string> {
    return this.cacheManager.cached(
      'block',
      ['blockHash', normalizeBlockRef(opts?.block)],
      `Failed to get block hash at ${normalizeBlockRef(opts?.block)}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getBlockHash(opts)),
      opts
    );
  }

  // Account operations
  public async getManagerKey(address: string, opts?: RPCOptions): Promise<ManagerKeyResponse | undefined> {
    return this.cacheManager.cached(
      'cycle',
      ['managerKey', address, normalizeBlockRef(opts?.block)],
      `Failed to get manager key for address ${address}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getManagerKey(address, opts), true),
      opts
    );
  }

  // Contract operations
  public async getContractResponse(address: string, opts?: RPCOptions): Promise<ContractResponse | undefined> {
    return this.cacheManager.cached(
      'block',
      ['contract', address, normalizeBlockRef(opts?.block)],
      `Failed to get contract ${address}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getContract(address, opts)),
      opts
    );
  }

  public async getScriptResponse(address: string, opts?: RPCOptions): Promise<ScriptResponse | undefined> {
    return this.getContractResponse(address, opts).then((contract) => contract?.script);
  }

  public async getStorageResponse(address: string, opts?: RPCOptions): Promise<StorageResponse | undefined> {
    return this.cacheManager.cached(
      'block',
      ['storage', address, normalizeBlockRef(opts?.block)],
      `Failed to get storage for contract ${address}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getStorage(address, opts)),
      opts
    );
  }

  public async getEntrypointsResponse(address: string, opts?: RPCOptions): Promise<EntrypointsResponse | undefined> {
    return this.cacheManager.cached(
      'block',
      ['entrypoints', address, normalizeBlockRef(opts?.block)],
      `Failed to get entrypoints for contract ${address}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getEntrypoints(address, opts)),
      opts
    );
  }

  // Big map operations
  public async getBigMapValue(id: string, key: Primitive, opts?: RPCOptions): Promise<BigMapResponse | undefined> {
    const expr: string = toExpr(key);
    return this.cacheManager.cached(
      'block',
      ['bigMap', id, expr, normalizeBlockRef(opts?.block)],
      `Failed to get big map value for id ${id} with key ${expr}`,
      () => raceRpcCalls((tezos) => tezos.rpc.getBigMapExpr(id, expr, opts).catch(() => undefined), true),
      opts
    );
  }

  // View operations
  public async runView(
    contract: string,
    entrypoint: string,
    input: MichelsonV1Expression,
    opts?: RPCOptions
  ): Promise<RunViewResult> {
    const chain_id: string = await this.getChainId();
    const expr: string = toExpr(JSON.stringify(input));
    return this.cacheManager.cached(
      'block',
      ['runView', contract, entrypoint, expr, normalizeBlockRef(opts?.block)],
      `Failed to run view on contract ${contract} with entrypoint ${entrypoint}`,
      () => raceRpcCalls((tezos) => tezos.rpc.runView({ contract, entrypoint, input, chain_id }, opts)),
      opts
    );
  }

  // Operation simulation and injection
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

  // Cache management
  public clearCache(): void {
    this.cacheManager.clear();
  }

  public getCacheStats() {
    return this.cacheManager.getStats();
  }

  // Configure cache settings
  public configureCacheManager(config: Partial<import('@/tezos/provider/cache-manager').CacheConfig>): void {
    this.cacheManager = new CacheManager({ ...DEFAULT_CACHE_CONFIG, ...config });
  }
}
