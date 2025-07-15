import { TezosOperationError, TezosToolkit } from '@taquito/taquito';
import { OperationContentsAndResult, RPCSimulateOperationParam, TezosGenericOperationError } from '@taquito/rpc';
import { toExpr } from '@/tezos/encoders';

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

export default class RpcProvider {
  public static singleton: RpcProvider = new RpcProvider();

  public getChainId(): Promise<string> {
    return Tezos().rpc.getChainId();
  }

  public getConstants(opts?: RPCOptions): Promise<ConstantsResponse> {
    return Tezos().rpc.getConstants(opts);
  }

  public async getBlockHash(opts?: RPCOptions): Promise<string> {
    return Tezos().rpc.getBlockHash(opts);
  }

  public async getProtocols(opts?: RPCOptions): Promise<ProtocolsResponse> {
    return Tezos().rpc.getProtocols(opts);
  }

  public async getManagerKey(address: string, opts?: RPCOptions): Promise<ManagerKeyResponse | undefined> {
    const managerKey: ManagerKeyResponse | undefined = await Tezos().rpc.getManagerKey(address, opts);
    handlePotentialOperationError(managerKey, `Failed to get manager key for address ${address}`);
    return managerKey;
  }

  public async getContractResponse(address: string, opts?: RPCOptions): Promise<ContractResponse | undefined> {
    const contract: ContractResponse | undefined = await Tezos()
      .rpc.getContract(address, opts)
      .catch(() => undefined);
    handlePotentialOperationError(contract, `Failed to get contract ${address}`);
    return contract;
  }

  public async getScriptResponse(address: string, opts?: RPCOptions): Promise<ScriptResponse | undefined> {
    return this.getContractResponse(address, opts).then((contract) => contract?.script);
  }

  public async getStorageResponse(address: string, opts?: RPCOptions): Promise<StorageResponse | undefined> {
    const storage: StorageResponse = await Tezos().rpc.getStorage(address, opts);
    handlePotentialOperationError(storage, `Failed to get storage for contract ${address}`);
    return storage;
  }

  public async getEntrypointsResponse(address: string, opts?: RPCOptions): Promise<EntrypointsResponse | undefined> {
    const entrypoints = await Tezos().rpc.getEntrypoints(address, opts);
    handlePotentialOperationError(entrypoints, `Failed to get entrypoints for contract ${address}`);
    return entrypoints;
  }

  public async getBigMapValue(id: string, key: Primitive, opts?: RPCOptions): Promise<BigMapResponse | undefined> {
    const expr: string = toExpr(key);
    const value: BigMapResponse | undefined = await Tezos()
      .rpc.getBigMapExpr(id, expr, opts)
      .catch(() => undefined);
    handlePotentialOperationError(value, `Failed to get big map value for id ${id} with key ${key} (${expr})`);
    return value;
  }

  public async runView(
    contract: string,
    entrypoint: string,
    input: MichelsonV1Expression,
    opts?: RPCOptions
  ): Promise<RunViewResult> {
    const chain_id: string = await this.getChainId();
    const result: RunViewResult = await Tezos().rpc.runView({ contract, entrypoint, input, chain_id }, opts);
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
