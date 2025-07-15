import { ParameterSchema, Schema } from '@taquito/michelson-encoder';

import { getMetadataStorage, isTezosLink, normalizeTezosUri } from '@/tezos/contracts/metadata';
import { BigMap, TezosStorage } from '@/tezos/contracts/storage';
import { MichelsonView, TZip17Metadata } from '@/tezos/types';
import { getFromIpfs, isIpfsLink } from '@/tools/ipfs';
import { assert, isJson } from '@/tools/utils';

export class TezosContract {
  public readonly storage: TezosStorage;

  constructor(
    public readonly address: string,
    public readonly contractResponse: ContractResponse,
    public readonly entrypointsResponse: EntrypointsResponse,
    protected readonly context: IRpcInstance
  ) {
    this.storage = new TezosStorage(contractResponse.script);
  }

  private static isView(view: MichelsonV1Expression): view is MichelsonView {
    if ('prim' in view && view.prim === 'pair' && view.args) {
      const lastElement: MichelsonV1Expression | undefined = view.args[view.args.length - 1];
      return lastElement !== undefined && 'prim' in lastElement && lastElement.prim === 'contract';
    }

    return false;
  }

  protected createMethod<T>(args: T, entrypoint: string): TransactionOperationParameter {
    const { [entrypoint]: method } = this.entrypointsResponse.entrypoints;
    assert(method !== undefined, 'method not found or invalid.');

    const methodSchema: ParameterSchema = new ParameterSchema(method);
    new Schema(method).Typecheck(args);

    const transferParameter: MichelsonV1Expression = methodSchema.EncodeObject(args);
    assert(transferParameter !== undefined, 'Failed to create transfer parameters.');

    return { entrypoint, value: transferParameter };
  }

  protected async executeView<T, U>(args: T, entrypoint: string): Promise<U> {
    const { [entrypoint]: view } = this.entrypointsResponse.entrypoints;
    assert(view !== undefined && TezosContract.isView(view), 'view not found or invalid.');

    const viewSchema: ParameterSchema = new ParameterSchema(view.args[0]);
    new Schema(view.args[0]).Typecheck(args);

    const result: RunViewResult = await this.context.runView(this.address, entrypoint, viewSchema.Encode(args));

    const callbackSchema: ParameterSchema = new ParameterSchema(view.args[1].args[0]);
    return callbackSchema.Execute(result.data);
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
      return getMetadataStorage<T>(normalizedUri);
    }

    return value as T;
  }

  public async getMetadata(): Promise<TZip17Metadata | undefined> {
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
}
