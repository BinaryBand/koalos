import { TezosOperationError, TezosToolkit } from '@taquito/taquito';
import { OperationContentsAndResult, RPCSimulateOperationParam, TezosGenericOperationError } from '@taquito/rpc';

import { toExpr } from '@/tezos/encoders';
// import { assert } from '@/tools/utils';

import RPC_URLS from '@public/constants/rpc-providers.json';

const TaquitoInstance: TezosToolkit = new TezosToolkit('');
function Tezos(rpc?: string): TezosToolkit {
  const randomIndex: number = Math.floor(Math.random() * RPC_URLS.length);
  rpc ??= RPC_URLS[randomIndex]!;
  TaquitoInstance.setProvider({ rpc });
  return TaquitoInstance;
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

function handlePotentialOperationError(result: any, message: string, meta: OperationContentsAndResult[] = []): void {
  if (isTezosGenericOperationError(result)) {
    throw new TezosOperationError(result, message, meta);
  }
}

import { LRUCache } from 'lru-cache';
import { Mutex, MutexInterface } from 'async-mutex';
export default class RpcProvider {
  private cache = new LRUCache({ max: 500, ttl: 1000 * 8 }); // 1 block delay
  private mutex: Mutex = new Mutex();

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

  private async calculateTtl(expirationType: 'block' | 'cycle', opts?: RPCOptions): Promise<number> {
    const headBlock: BlockResponse = await this.getBlock(opts);
    const constants: ConstantsResponse = this.getCachedValue('constants') ?? (await Tezos().rpc.getConstants(opts));

    const { metadata } = headBlock;
    const { minimal_block_delay, blocks_per_cycle, time_between_blocks } = constants;

    const minBlockDelay: number = parseInt(`${minimal_block_delay ?? time_between_blocks[0] ?? 8}`, 10);
    const cyclePosition: number = metadata.level_info?.cycle_position ?? blocks_per_cycle - 1;
    const blocksLeftInCycle: number = blocks_per_cycle - cyclePosition;

    await this.setCachedValue('headBlock', headBlock, 1000 * minBlockDelay);
    await this.setCachedValue('constants', constants, 1000 * minBlockDelay * blocksLeftInCycle);

    return expirationType === 'block' ? 1000 * minBlockDelay : 1000 * minBlockDelay * blocksLeftInCycle;
  }

  public async getChainId(): Promise<string> {
    let chainId: string | undefined = this.getCachedValue<string>('chainId');
    if (!chainId) {
      chainId = await Tezos().rpc.getChainId();

      const ttl: number = await this.calculateTtl('cycle');
      await this.setCachedValue('chainId', chainId, ttl);
    }
    handlePotentialOperationError(chainId, 'Failed to get chain ID');
    return chainId;
  }

  public async getConstants(opts?: RPCOptions): Promise<ConstantsResponse> {
    const constantsCacheKey: string = `constants_${opts?.block ?? 'head'}`;
    const constants: ConstantsResponse =
      this.getCachedValue(constantsCacheKey) ?? (await Tezos().rpc.getConstants(opts));
    handlePotentialOperationError(constants, `Failed to get constants at block ${opts?.block ?? 'head'}`);
    this.setCachedValue(constantsCacheKey, constants, 100000);
    return constants;
  }

  public async getProtocols(opts?: RPCOptions): Promise<ProtocolsResponse> {
    const cacheKey: string = `protocols_${opts?.block ?? 'head'}`;

    let protocols: ProtocolsResponse | undefined = this.getCachedValue(cacheKey);
    if (!protocols) {
      protocols = await Tezos().rpc.getProtocols(opts);

      const ttl: number = await this.calculateTtl('cycle', opts);
      await this.setCachedValue(cacheKey, protocols, ttl);
    }

    handlePotentialOperationError(protocols, `Failed to get protocols at block ${opts?.block ?? 'head'}`);
    return protocols;
  }

  public async getBlock(opts?: RPCOptions): Promise<BlockResponse> {
    const cacheKey: string = `block_${opts?.block ?? 'head'}`;
    const block: BlockResponse = this.getCachedValue(cacheKey) ?? (await Tezos().rpc.getBlock(opts));
    const { minimal_block_delay, time_between_blocks } = await this.getConstants(opts);
    const minBlockDelay: number = parseInt(`${minimal_block_delay ?? time_between_blocks[0] ?? 8}`, 10);
    await this.setCachedValue(cacheKey, block, 1000 * minBlockDelay);
    handlePotentialOperationError(block, `Failed to get block at ${opts?.block ?? 'head'}`);
    return block;
  }

  public async getBlockHash(opts?: RPCOptions): Promise<string> {
    return this.getBlock(opts).then((block) => block.hash);
  }

  public async getManagerKey(address: string, opts?: RPCOptions): Promise<ManagerKeyResponse | undefined> {
    const cacheKey: string = `managerKey_${address}_${opts?.block ?? 'head'}`;

    let managerKey: ManagerKeyResponse | undefined = this.getCachedValue(cacheKey);
    if (!managerKey) {
      managerKey = await Tezos().rpc.getManagerKey(address, opts);

      const ttl: number = await this.calculateTtl(managerKey ? 'cycle' : 'block', opts);
      await this.setCachedValue(cacheKey, managerKey, ttl);
    }

    handlePotentialOperationError(managerKey, `Failed to get manager key for address ${address}`);
    return managerKey;
  }

  public async getContractResponse(address: string, opts?: RPCOptions): Promise<ContractResponse | undefined> {
    const cacheKey: string = `contract_${address}_${opts?.block ?? 'head'}`;

    let contract: ContractResponse | undefined = this.getCachedValue(cacheKey);
    if (!contract) {
      contract = await Tezos().rpc.getContract(address, opts);

      const ttl: number = await this.calculateTtl('block', opts);
      await this.setCachedValue(cacheKey, contract, ttl);
    }

    handlePotentialOperationError(contract, `Failed to get contract ${address}`);
    return contract;
  }

  public async getScriptResponse(address: string, opts?: RPCOptions): Promise<ScriptResponse | undefined> {
    return this.getContractResponse(address, opts).then((contract) => contract?.script);
  }

  public async getStorageResponse(address: string, opts?: RPCOptions): Promise<StorageResponse | undefined> {
    const cacheKey: string = `storage_${address}_${opts?.block ?? 'head'}`;

    let storage: StorageResponse | undefined = this.getCachedValue(cacheKey);
    if (!storage) {
      storage = await Tezos().rpc.getStorage(address, opts);

      const ttl: number = await this.calculateTtl('block', opts);
      await this.setCachedValue(cacheKey, storage, ttl);
    }

    handlePotentialOperationError(storage, `Failed to get storage for contract ${address}`);
    return storage;
  }

  public async getEntrypointsResponse(address: string, opts?: RPCOptions): Promise<EntrypointsResponse | undefined> {
    const cacheKey: string = `entrypoints_${address}_${opts?.block ?? 'head'}`;

    let entrypoints: EntrypointsResponse | undefined = this.getCachedValue(cacheKey);
    if (!entrypoints) {
      entrypoints = await Tezos().rpc.getEntrypoints(address, opts);

      const ttl: number = await this.calculateTtl('block', opts);
      await this.setCachedValue(cacheKey, entrypoints, ttl);
    }

    handlePotentialOperationError(entrypoints, `Failed to get entrypoints for contract ${address}`);
    return entrypoints;
  }

  public async getBigMapValue(id: string, key: Primitive, opts?: RPCOptions): Promise<BigMapResponse | undefined> {
    const expr: string = toExpr(key);
    const cacheKey: string = `bigMap_${id}_${expr}_${opts?.block ?? 'head'}`;

    let bigMapValue: BigMapResponse | undefined = this.getCachedValue(cacheKey);
    if (!bigMapValue) {
      bigMapValue = await Tezos()
        .rpc.getBigMapExpr(id, expr, opts)
        .catch(() => undefined);

      if (bigMapValue) {
        const ttl: number = await this.calculateTtl('block', opts);
        await this.setCachedValue(cacheKey, bigMapValue, ttl);
      }
    }

    handlePotentialOperationError(bigMapValue, `Failed to get big map value for id ${id} with key ${toExpr(key)}`);
    return bigMapValue;
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

    let result: RunViewResult | undefined = this.getCachedValue(cacheKey);
    if (!result) {
      result = await Tezos().rpc.runView({ contract, entrypoint, input, chain_id }, opts);

      const ttl: number = await this.calculateTtl('block', opts);
      await this.setCachedValue(cacheKey, result, ttl);
    }

    handlePotentialOperationError(result, `Failed to run view on contract ${contract} with entrypoint ${entrypoint}`);
    return result;
  }

  public async simulateOperation(operation: RPCSimulateOperationParam, opts?: RPCOptions): Promise<PreapplyResponse> {
    const simulation: PreapplyResponse = await Tezos().rpc.simulateOperation(operation, opts);
    handlePotentialOperationError(simulation, `Failed simulation: ${(JSON.stringify(operation), null, 2)}`);
    return simulation;
  }

  public async injectOperation(signedOperation: string): Promise<string> {
    const injectionResult: string = await Tezos().rpc.injectOperation(signedOperation);
    handlePotentialOperationError(injectionResult, `Failed to inject operation: ${signedOperation}`);
    return injectionResult;
  }
}
