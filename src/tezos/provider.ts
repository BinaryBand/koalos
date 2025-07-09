import { TezosToolkit } from '@taquito/taquito';
import {
  BigMapResponse,
  ConstantsResponse,
  ManagerKeyResponse,
  PreapplyResponse,
  ProtocolsResponse,
  RPCOptions,
  RPCSimulateOperationParam,
} from '@taquito/rpc';
import { ContractResponse, EntrypointsResponse, RunViewResult, StorageResponse } from '@taquito/rpc';

import RPC_URLS from '@public/constants/rpc-providers.json';
import { toExpr } from '@/tezos/codec';

const TaquitoInstances: TezosToolkit[] = RPC_URLS.map((rpc: string) => new TezosToolkit(rpc));

function Tezos(): TezosToolkit {
  const randomIndex: number = Math.floor(Math.random() * TaquitoInstances.length);
  return TaquitoInstances[randomIndex]!;
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
    return Tezos().rpc.getManagerKey(address, options);
  }

  public static async getContractResponse(
    contract: string,
    options?: RPCOptions
  ): Promise<ContractResponse | undefined> {
    return Tezos().rpc.getContract(contract, options);
  }

  public static async getStorageResponse(contract: string, options?: RPCOptions): Promise<StorageResponse | undefined> {
    return Tezos().rpc.getStorage(contract, options);
  }

  public static async getEntrypointsResponse(
    contract: string,
    options?: RPCOptions
  ): Promise<EntrypointsResponse | undefined> {
    return Tezos().rpc.getEntrypoints(contract, options);
  }

  public static async getBigMapValue(
    id: string,
    key: Primitive,
    options?: RPCOptions
  ): Promise<BigMapResponse | undefined> {
    const expr: string = toExpr(key);
    return Tezos()
      .rpc.getBigMapExpr(id, expr, options)
      .catch(() => undefined);
  }

  public static async runView(
    contract: string,
    entrypoint: string,
    input: MichelsonV1Expression,
    options?: RPCOptions
  ): Promise<RunViewResult> {
    const chain_id: string = await Blockchain.chainId;
    return Tezos().rpc.runView({ contract, entrypoint, input, chain_id }, options);
  }

  public static async simulateOperation(
    operation: RPCSimulateOperationParam,
    options?: RPCOptions
  ): Promise<PreapplyResponse> {
    return Tezos().rpc.simulateOperation(operation, options);
  }

  public static async injectOperation(signedOperation: string): Promise<string> {
    return Tezos().rpc.injectOperation(signedOperation);
  }
}
