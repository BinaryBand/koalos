export * from '@/tezos/smart-contracts/quipuswap';
export { TezosContract } from '@/tezos/provider';

// import { BigMapResponse, EntrypointsResponse, RPCOptions, RunViewResult } from '@taquito/rpc';
// import { ParameterSchema, Schema } from '@taquito/michelson-encoder';

// import { BlockchainInstance } from '@/tezos/provider';
// import { assert } from '@/tools/utils';

// export class TezosContract {
//   constructor(
//     public readonly address: string,
//     protected readonly context: BlockchainInstance = new BlockchainInstance()
//   ) {}

//   private isView(view: MichelsonV1Expression): view is MichelsonView {
//     if ('prim' in view && view.prim === 'pair' && view.args) {
//       const lastElement: MichelsonV1Expression | undefined = view.args[view.args.length - 1];
//       return lastElement !== undefined && 'prim' in lastElement && lastElement.prim === 'contract';
//     }

//     return false;
//   }

//   protected async createMethod<T>(args: T, entrypoint: string): Promise<TransactionOperationParameter> {
//     const entrypoints: EntrypointsResponse | undefined = await this.context.getEntrypointsResponse(this.address);
//     assert(entrypoints !== undefined, `Entrypoints not found for contract: ${this.address}`);

//     const { [entrypoint]: method } = entrypoints.entrypoints;
//     assert(method !== undefined, 'method not found or invalid.');

//     const methodSchema: ParameterSchema = new ParameterSchema(method);
//     new Schema(method).Typecheck(args);

//     const transferParameter: MichelsonV1Expression = methodSchema.EncodeObject(args);
//     assert(transferParameter !== undefined, 'Failed to create transfer parameters.');

//     return { entrypoint, value: transferParameter };
//   }

//   protected async executeView<T, U>(args: T, entrypoint: string): Promise<U> {
//     const entrypoints: EntrypointsResponse | undefined = await this.context.getEntrypointsResponse(this.address);
//     assert(entrypoints !== undefined, `Entrypoints not found for contract: ${this.address}`);

//     const { [entrypoint]: view } = entrypoints.entrypoints;
//     assert(view !== undefined && this.isView(view), 'view not found or invalid.');

//     const viewSchema: ParameterSchema = new ParameterSchema(view.args[0]);
//     new Schema(view.args[0]).Typecheck(args);

//     const result: RunViewResult = await this.context.runView(this.address, entrypoint, viewSchema.Encode(args));

//     const callbackSchema: ParameterSchema = new ParameterSchema(view.args[1].args[0]);
//     return callbackSchema.Execute(result.data);
//   }

//   public getScriptResponse(opts?: RPCOptions): Promise<ScriptResponse | undefined> {
//     return this.context.getScriptResponse(this.address, opts);
//   }

//   public getBigMapValue(id: string, key: Primitive): Promise<BigMapResponse | undefined> {
//     return this.context.getBigMapValue(id, key);
//   }
// }

export { BigMap, TezosStorage } from './storage';
