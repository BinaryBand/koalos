import { TezosOperationError, TezosToolkit } from '@taquito/taquito';
import {
  BigMapResponse,
  castToBigNumber,
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
import { MichelsonMap, ParameterSchema, Schema, Token, UnitValue } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';

import RPC_URLS from '@public/constants/rpc-providers.json';
import { decodeMichelsonValue, toExpr, unwrapMichelsonMap } from '@/tezos/encoders';
import { assert, isJson } from '@/tools/utils';
import { Fa2Balance, Fa2BalanceRequest, OperatorUpdate, TZip17Metadata, TZip21TokenMetadata } from './types';
import { getFromIpfs, isIpfsLink } from '@/tools/ipfs';
import { getMetadataStorage, isTezosLink, normalizeTezosUri } from './contracts/metadata';

type MichelsonView = MichelsonV1ExpressionExtended & {
  prim: 'pair';
  args: [MichelsonV1Expression, { prim: 'contract'; args: [MichelsonV1Expression] }];
};

type TokenMetadata = {
  token_info?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
  1?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
};

const TaquitoInstance: TezosToolkit = new TezosToolkit('');

export function Tezos(rpc?: string): TezosToolkit {
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

class RpcProvider {
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

function isFa12(entrypointsResponse: EntrypointsResponse): boolean {
  return 'getBalance' in entrypointsResponse.entrypoints;
}

function isFa2(entrypointsResponse: EntrypointsResponse): boolean {
  return 'balance_of' in entrypointsResponse.entrypoints;
}

export class BlockchainInstance extends RpcProvider {
  public async getContract(address: string): Promise<TezosContract | undefined> {
    const contractResponse = await this.getContractResponse(address);
    return contractResponse ? new TezosContract(address, contractResponse, this) : undefined;
  }

  public async getFaToken(address: string): Promise<IFaToken | undefined> {
    const [contractResponse, entrypointsResponse] = await Promise.all([
      this.getContractResponse(address),
      this.getEntrypointsResponse(address),
    ]);

    if (contractResponse && entrypointsResponse) {
      if (isFa12(entrypointsResponse)) {
        return new Fa12Token(address, contractResponse, entrypointsResponse, this);
      } else if (isFa2(entrypointsResponse)) {
        return new Fa2Token(address, contractResponse, entrypointsResponse, this);
      }
    }

    return undefined;
  }
}

export class TezosContract {
  protected readonly storage: TezosStorage;

  constructor(
    public readonly address: string,
    public readonly contractResponse: ContractResponse,
    private readonly context: BlockchainInstance = new BlockchainInstance()
  ) {
    this.storage = new TezosStorage(contractResponse.script, this);
  }

  private isView(view: MichelsonV1Expression): view is MichelsonView {
    if ('prim' in view && view.prim === 'pair' && view.args) {
      const lastElement: MichelsonV1Expression | undefined = view.args[view.args.length - 1];
      return lastElement !== undefined && 'prim' in lastElement && lastElement.prim === 'contract';
    }

    return false;
  }

  protected async createMethod<T>(args: T, entrypoint: string): Promise<TransactionOperationParameter> {
    const entrypoints: EntrypointsResponse | undefined = await this.context.getEntrypointsResponse(this.address);
    assert(entrypoints !== undefined, `Entrypoints not found for contract: ${this.address}`);

    const { [entrypoint]: method } = entrypoints.entrypoints;
    assert(method !== undefined, 'method not found or invalid.');

    const methodSchema: ParameterSchema = new ParameterSchema(method);
    new Schema(method).Typecheck(args);

    const transferParameter: MichelsonV1Expression = methodSchema.EncodeObject(args);
    assert(transferParameter !== undefined, 'Failed to create transfer parameters.');

    return { entrypoint, value: transferParameter };
  }

  protected async executeView<T, U>(args: T, entrypoint: string): Promise<U> {
    const entrypoints: EntrypointsResponse | undefined = await this.context.getEntrypointsResponse(this.address);
    assert(entrypoints !== undefined, `Entrypoints not found for contract: ${this.address}`);

    const { [entrypoint]: view } = entrypoints.entrypoints;
    assert(view !== undefined && this.isView(view), 'view not found or invalid.');

    const viewSchema: ParameterSchema = new ParameterSchema(view.args[0]);
    new Schema(view.args[0]).Typecheck(args);

    const result: RunViewResult = await this.context.runView(this.address, entrypoint, viewSchema.Encode(args));

    const callbackSchema: ParameterSchema = new ParameterSchema(view.args[1].args[0]);
    return callbackSchema.Execute(result.data);
  }

  public getScriptResponse(opts?: RPCOptions): Promise<ScriptResponse | undefined> {
    return this.context.getScriptResponse(this.address, opts);
  }

  public getBigMapValue(id: string, key: Primitive): Promise<BigMapResponse | undefined> {
    return this.context.getBigMapValue(id, key);
  }
}

interface IFaToken {
  getMetadata(): Promise<TZip17Metadata | undefined>;
  getTokenMetadata(tokenId?: number): Promise<TZip21TokenMetadata | undefined>;
  getBalance(address: string): Promise<BigNumber>;
  transfer(from: string, to: string, value: BigNumber.Value, tokenId?: number): Promise<TransactionOperationParameter>;
}

class FaToken extends TezosContract {
  constructor(
    address: string,
    contractResponse: ContractResponse,
    public readonly entrypointsResponse: EntrypointsResponse,
    context?: BlockchainInstance
  ) {
    super(address, contractResponse, context);
  }

  private async resolvePossibleLink<T>(value: string, contractAddress?: string): Promise<T | undefined> {
    value = value.replace(/[\x00-\x1F\x7F]/g, '');

    if (isJson(value)) {
      return JSON.parse(value);
    }

    if (isIpfsLink(value)) {
      return getFromIpfs<T>(value);
    }

    if (isTezosLink(value)) {
      const normalizedUri: string = normalizeTezosUri(value, contractAddress);
      return getMetadataStorage<T>(normalizedUri, this);
    }

    return value as T;
  }

  async getMetadata(): Promise<TZip17Metadata | undefined> {
    const bigMap: BigMap | undefined = this.storage?.get<BigMap>('metadata');
    const result: TZip17Metadata | string | undefined = await bigMap?.get<TZip17Metadata | string>('');

    // If the metadata is not a MichelsonMap, we try to access the standard fields directly
    if (result === undefined) {
      const [name, description, version] = await Promise.all([
        bigMap?.get<string>('name'),
        bigMap?.get<string>('description'),
        bigMap?.get<string>('version'),
      ]);

      return { name, description, version } as TZip17Metadata;
    }

    // Get the metadata from the big map or resolve it if it's a link
    return typeof result === 'string' ? this.resolvePossibleLink<TZip17Metadata>(result, this.address) : result;
  }

  async getTokenMetadata(tokenId: number = 0): Promise<TZip21TokenMetadata | undefined> {
    const bigMap: BigMap | undefined = this.storage?.get<BigMap>('token_metadata');

    const tokenMetadata: TokenMetadata | undefined = await bigMap?.get(tokenId);
    const tokenInfo: unknown = tokenMetadata?.['token_info'] ?? tokenMetadata?.['1'];

    if (MichelsonMap.isMichelsonMap(tokenInfo)) {
      const unwrappedMap: TZip21TokenMetadata = unwrapMichelsonMap(tokenInfo);
      return { ...unwrappedMap, ...castToBigNumber(unwrappedMap, []) };
    }

    return tokenInfo as TZip21TokenMetadata;
  }

  async getBalance(_address: string): Promise<BigNumber> {
    throw new Error('getBalance method is not implemented for generic FaToken');
  }

  async transfer(
    _from: string,
    _to: string,
    _value: BigNumber.Value,
    _tokenId?: number
  ): Promise<TransactionOperationParameter> {
    throw new Error('transfer method is not implemented for generic FaToken');
  }
}

/*****************************************************
 * TZip-5
 * FA1 Interface
 * https://tzip.tezosagora.org/proposal/tzip-5
 *****************************************************/

/*****************************************************
 * TZip-7
 * FA1.2 Interface
 * https://tzip.tezosagora.org/proposal/tzip-7
 *****************************************************/

export class Fa12Token extends FaToken implements IFaToken {
  constructor(
    address: string,
    contractResponse: ContractResponse,
    entrypointsResponse: EntrypointsResponse,
    context?: BlockchainInstance
  ) {
    super(address, contractResponse, entrypointsResponse, context);
  }

  override async transfer(
    from: string,
    to: string,
    value: BigNumber.Value,
    tokenId: number = 0
  ): Promise<TransactionOperationParameter> {
    return this.createMethod({ from, to, value: BigNumber(value), tokenId }, 'transfer');
  }

  override async getBalance(address: string): Promise<BigNumber> {
    return this.executeView<string, BigNumber>(address, 'getBalance');
  }

  async getTotalSupply(): Promise<BigNumber> {
    return this.executeView<typeof UnitValue, BigNumber>(UnitValue, 'getTotalSupply');
  }
}

/*****************************************************
 * TZip-12
 * FA2 Interface
 * https://tzip.tezosagora.org/proposal/tzip-12
 *****************************************************/

export class Fa2Token extends FaToken implements IFaToken {
  constructor(
    address: string,
    contractResponse: ContractResponse,
    entrypointsResponse: EntrypointsResponse,
    context?: BlockchainInstance
  ) {
    super(address, contractResponse, entrypointsResponse, context);
  }

  async balanceOf(args: Fa2BalanceRequest[]): Promise<Fa2Balance[]> {
    return this.executeView<Fa2BalanceRequest[], Fa2Balance[]>(args, 'balance_of');
  }

  override async transfer(
    from: string,
    to: string,
    value: BigNumber.Value,
    tokenId: number = 0
  ): Promise<TransactionOperationParameter> {
    return this.createMethod(
      [
        {
          from_: from,
          txs: [{ to_: to, token_id: tokenId, amount: BigNumber(value) }],
        },
      ],
      'transfer'
    );
  }

  async update_operators(ops: OperatorUpdate[]): Promise<TransactionOperationParameter> {
    return this.createMethod(ops, 'update_operators');
  }
}

export class TezosStorage {
  private readonly schema: Schema;
  private readonly storageResponse: unknown;

  constructor(public readonly script: ScriptResponse, private readonly context: TezosContract) {
    this.schema = Schema.fromRPCResponse({ script });
    this.storageResponse = this.schema.Execute(script.storage);
  }

  private static findBigMapId(obj: object, key: string): string | undefined {
    for (const [k, val] of Object.entries(obj)) {
      if (k === key && BigMap.isBigMapId(val)) {
        return val;
      }

      if (typeof val === 'object' && val !== null) {
        const result: string | undefined = TezosStorage.findBigMapId(val, key);
        if (result !== undefined && BigMap.isBigMapId(result)) {
          return result;
        }
      }
    }

    return undefined;
  }

  public get<T>(key: string): T | undefined {
    if (!this.storageResponse) {
      return undefined;
    }

    if (typeof this.storageResponse !== 'object') {
      return this.storageResponse as T;
    }

    // Check if the key corresponds to a big_map in the schema
    const bigMapSchema: Token | undefined = this.schema.findToken('big_map').find((t): boolean => t.annot() === key);
    if (bigMapSchema !== undefined) {
      const bigMapId: string = TezosStorage.findBigMapId(this.storageResponse, key)!;
      const michelsonSchema: MichelsonV1Expression | undefined = bigMapSchema.tokenVal.args?.[1];
      return new BigMap(bigMapId, michelsonSchema!, this.context) as T;
    }

    return key in this.storageResponse ? ((this.storageResponse as Record<string, unknown>)[key] as T) : undefined;
  }
}

export class BigMap {
  private readonly _id: BigNumber;
  private readonly schema: Schema | undefined;

  public get id(): BigNumber {
    return this._id;
  }

  constructor(id: BigNumber.Value, michelsonSchema: MichelsonV1Expression, private readonly context: TezosContract) {
    this._id = BigNumber(id);
    this.schema = michelsonSchema ? new Schema(michelsonSchema) : undefined;
    assert(/\d+/.test(this._id.toString()), `Invalid BigMap ID: ${this._id.toString()}`);
  }

  public static isBigMapId(value: unknown): boolean {
    return typeof value === 'string' && /\d+/.test(value);
  }

  public async get<T>(key: Primitive): Promise<T | undefined> {
    const bigMapResponse: BigMapResponse | undefined = await this.context.getBigMapValue(this._id.toString(), key);
    if (bigMapResponse === undefined) return undefined;

    const rawValue: unknown = this.schema?.Execute(bigMapResponse);
    const final: T | undefined = await decodeMichelsonValue<T>(rawValue, this.schema);

    return final;
  }
}
