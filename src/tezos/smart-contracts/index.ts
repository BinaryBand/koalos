export * from '@/tezos/smart-contracts/quipuswap';

import { ContractResponse, EntrypointsResponse, RunViewResult, TransactionOperationParameter } from '@taquito/rpc';
import { ParameterSchema, Schema } from '@taquito/michelson-encoder';

import { Blockchain } from '@/tezos/provider';
import { TezosStorage } from '@/tezos/storage';
import { assert } from '@/tools/utils';

export class Contract {
  constructor(public readonly address: string) {}

  public get storage(): Promise<TezosStorage | undefined> {
    return Blockchain.getContractResponse(this.address).then((c?: ContractResponse) =>
      c ? new TezosStorage(this.address, c.script) : undefined
    );
  }

  private isView(view: MichelsonExpression): view is MichelsonView {
    if ('prim' in view && view.prim === 'pair' && view.args) {
      const lastElement: MichelsonExpression | undefined = view.args[view.args.length - 1];
      return lastElement !== undefined && 'prim' in lastElement && lastElement.prim === 'contract';
    }

    return false;
  }

  protected async createMethod<T>(args: T, entrypoint: string): Promise<TransactionOperationParameter> {
    const entrypoints: EntrypointsResponse | undefined = await Blockchain.getEntrypointsResponse(this.address);
    assert(entrypoints !== undefined, `Entrypoints not found for contract: ${this.address}`);

    const { [entrypoint]: method } = entrypoints.entrypoints;
    assert(method !== undefined, 'method not found or invalid.');

    const methodSchema: ParameterSchema = new ParameterSchema(method);
    new Schema(method).Typecheck(args);

    const transferParameter: MichelsonExpression = methodSchema.EncodeObject(args);
    assert(transferParameter !== undefined, 'Failed to create transfer parameters.');

    return { entrypoint, value: transferParameter };
  }

  protected async executeView<T, U>(args: T, entrypoint: string): Promise<U> {
    const entrypoints: EntrypointsResponse | undefined = await Blockchain.getEntrypointsResponse(this.address);
    assert(entrypoints !== undefined, `Entrypoints not found for contract: ${this.address}`);

    const { [entrypoint]: view } = entrypoints.entrypoints;
    assert(view !== undefined && this.isView(view), 'view not found or invalid.');

    const viewSchema: ParameterSchema = new ParameterSchema(view.args[0]);
    new Schema(view.args[0]).Typecheck(args);

    const result: RunViewResult = await Blockchain.runView(this.address, entrypoint, viewSchema.Encode(args));

    const callbackSchema: ParameterSchema = new ParameterSchema(view.args[1].args[0]);
    return callbackSchema.Execute(result.data);
  }
}
