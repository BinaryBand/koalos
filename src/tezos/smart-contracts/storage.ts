export { TezosStorage, BigMap } from '@/tezos/provider';

// import { BigMapResponse } from '@taquito/rpc';
// import { Schema, Token } from '@taquito/michelson-encoder';
// import { BigNumber } from 'bignumber.js';

// import { decodeMichelsonValue } from '@/tezos/encoders';
// import { assert } from '@/tools/utils';
// import { TezosContract } from '@/index';

// export class TezosStorage {
//   private readonly schema: Schema;
//   private readonly storageResponse: unknown;

//   constructor(public readonly script: ScriptResponse, private readonly context: TezosContract) {
//     this.schema = Schema.fromRPCResponse({ script });
//     this.storageResponse = this.schema.Execute(script.storage);
//   }

//   private static findBigMapId(obj: object, key: string): string | undefined {
//     for (const [k, val] of Object.entries(obj)) {
//       if (k === key && BigMap.isBigMapId(val)) {
//         return val;
//       }

//       if (typeof val === 'object' && val !== null) {
//         const result: string | undefined = TezosStorage.findBigMapId(val, key);
//         if (result !== undefined && BigMap.isBigMapId(result)) {
//           return result;
//         }
//       }
//     }

//     return undefined;
//   }

//   public get<T>(key: string): T | undefined {
//     if (!this.storageResponse) {
//       return undefined;
//     }

//     if (typeof this.storageResponse !== 'object') {
//       return this.storageResponse as T;
//     }

//     // Check if the key corresponds to a big_map in the schema
//     const bigMapSchema: Token | undefined = this.schema.findToken('big_map').find((t): boolean => t.annot() === key);
//     if (bigMapSchema !== undefined) {
//       const bigMapId: string = TezosStorage.findBigMapId(this.storageResponse, key)!;
//       const michelsonSchema: MichelsonV1Expression | undefined = bigMapSchema.tokenVal.args?.[1];
//       return new BigMap(bigMapId, michelsonSchema!, this.context) as T;
//     }

//     return key in this.storageResponse ? ((this.storageResponse as Record<string, unknown>)[key] as T) : undefined;
//   }
// }

// export class BigMap {
//   private readonly _id: BigNumber;
//   private readonly schema: Schema | undefined;

//   public get id(): BigNumber {
//     return this._id;
//   }

//   constructor(id: BigNumber.Value, michelsonSchema: MichelsonV1Expression, private readonly context: TezosContract) {
//     this._id = BigNumber(id);
//     this.schema = michelsonSchema ? new Schema(michelsonSchema) : undefined;
//     assert(/\d+/.test(this._id.toString()), `Invalid BigMap ID: ${this._id.toString()}`);
//   }

//   public static isBigMapId(value: unknown): boolean {
//     return typeof value === 'string' && /\d+/.test(value);
//   }

//   public async get<T>(key: Primitive): Promise<T | undefined> {
//     const bigMapResponse: BigMapResponse | undefined = await this.context.getBigMapValue(this._id.toString(), key);
//     if (bigMapResponse === undefined) return undefined;

//     const rawValue: unknown = this.schema?.Execute(bigMapResponse);
//     const final: T | undefined = await decodeMichelsonValue<T>(rawValue, this.schema);

//     return final;
//   }
// }
