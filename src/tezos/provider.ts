import { TezosOperationError, TezosToolkit } from '@taquito/taquito';
import {
  BigMapResponse,
  ConstantsResponse,
  ManagerKeyResponse,
  OperationContentsAndResult,
  PreapplyResponse,
  ProtocolsResponse,
  RPCOptions,
  RPCSimulateOperationParam,
  TezosGenericOperationError,
} from '@taquito/rpc';
import { ContractResponse, EntrypointsResponse, RunViewResult, StorageResponse } from '@taquito/rpc';

import RPC_URLS from '@public/constants/rpc-providers.json';
import { toExpr } from '@/tezos/encoders';

const TaquitoInstances: TezosToolkit[] = RPC_URLS.map((rpc: string) => new TezosToolkit(rpc));

export function Tezos(): TezosToolkit {
  const randomIndex: number = Math.floor(Math.random() * TaquitoInstances.length);
  return TaquitoInstances[randomIndex]!;
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

export class Blockchain {
  public static get chainId(): Promise<string> {
    return Tezos().rpc.getChainId();
  }

  public static get constants(): Promise<ConstantsResponse> {
    return Tezos().rpc.getConstants();
  }

  public static async getBlockHash(options?: RPCOptions): Promise<string> {
    return Tezos().rpc.getBlockHash(options);
  }

  public static async getProtocols(options?: RPCOptions): Promise<ProtocolsResponse> {
    return Tezos().rpc.getProtocols(options);
  }

  public static async getManagerKey(address: string, options?: RPCOptions): Promise<ManagerKeyResponse | undefined> {
    const managerKey: ManagerKeyResponse | undefined = await Tezos().rpc.getManagerKey(address, options);
    handlePotentialOperationError(managerKey, `Failed to get manager key for address ${address}`);
    return managerKey;
  }

  public static async getContractResponse(
    address: string,
    options?: RPCOptions
  ): Promise<ContractResponse | undefined> {
    const contract: ContractResponse | undefined = await Tezos().rpc.getContract(address, options);
    handlePotentialOperationError(contract, `Failed to get contract ${address}`);
    return contract;
  }

  public static async getStorageResponse(address: string, options?: RPCOptions): Promise<StorageResponse | undefined> {
    const storage: StorageResponse = await Tezos().rpc.getStorage(address, options);
    handlePotentialOperationError(storage, `Failed to get storage for contract ${address}`);
    return storage;
  }

  public static async getEntrypointsResponse(
    address: string,
    options?: RPCOptions
  ): Promise<EntrypointsResponse | undefined> {
    const entrypoints = await Tezos().rpc.getEntrypoints(address, options);
    handlePotentialOperationError(entrypoints, `Failed to get entrypoints for contract ${address}`);
    return entrypoints;
  }

  public static async getBigMapValue(
    id: string,
    key: Primitive,
    options?: RPCOptions
  ): Promise<BigMapResponse | undefined> {
    const expr: string = toExpr(key);
    const value: BigMapResponse | undefined = await Tezos()
      .rpc.getBigMapExpr(id, expr, options)
      .catch(() => undefined);
    handlePotentialOperationError(value, `Failed to get big map value for id ${id} with key ${key} (${expr})`);
    return value;
  }

  public static async runView(
    contract: string,
    entrypoint: string,
    input: MichelsonV1Expression,
    options?: RPCOptions
  ): Promise<RunViewResult> {
    const chain_id: string = await Blockchain.chainId;
    const result: RunViewResult = await Tezos().rpc.runView({ contract, entrypoint, input, chain_id }, options);
    handlePotentialOperationError(result, `Failed to run view on contract ${contract} with entrypoint ${entrypoint}`);
    return result;
  }

  public static async simulateOperation(
    operation: RPCSimulateOperationParam,
    options?: RPCOptions
  ): Promise<PreapplyResponse> {
    const simulation: PreapplyResponse = await Tezos().rpc.simulateOperation(operation, options);
    handlePotentialOperationError(simulation, `Failed simulation: ${(JSON.stringify(operation), null, 2)}`);
    return simulation;
  }

  public static async injectOperation(signedOperation: string): Promise<string> {
    const injectionResult: string = await Tezos().rpc.injectOperation(signedOperation);
    handlePotentialOperationError(injectionResult, `Failed to inject operation: ${signedOperation}`);
    return injectionResult;
  }
}
