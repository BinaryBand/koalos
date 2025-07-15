import { Schema, Token } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';

import { decodeMichelsonValue } from '@/tezos/encoders';
import RpcProvider from '@/tezos/provider';
import { assert } from '@/tools/utils';

export class TezosStorage {
  private readonly schema: Schema;
  private readonly data: unknown;

  constructor(public readonly script: ScriptResponse) {
    this.schema = Schema.fromRPCResponse({ script });
    this.data = this.schema.Execute(script.storage);
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
    if (!this.data) {
      return undefined;
    }

    if (typeof this.data !== 'object') {
      return this.data as T;
    }

    // Check if the key corresponds to a big_map in the schema
    const bigMapSchema: Token | undefined = this.schema.findToken('big_map').find((t): boolean => t.annot() === key);
    if (bigMapSchema !== undefined) {
      const bigMapId: string = TezosStorage.findBigMapId(this.data, key)!;
      const michelsonSchema: MichelsonV1Expression | undefined = bigMapSchema.tokenVal.args?.[1];
      return new BigMap(bigMapId, michelsonSchema!) as T;
    }

    return (this.data as { [key: string]: T | undefined })[key];
  }
}

export class BigMap {
  public readonly id: BigNumber;
  private readonly schema: Schema | undefined;

  constructor(id: BigNumber.Value, michelsonSchema: MichelsonV1Expression) {
    this.id = BigNumber(id);
    this.schema = michelsonSchema ? new Schema(michelsonSchema) : undefined;
    assert(/\d+/.test(this.id.toString()), `Invalid BigMap ID: ${this.id.toString()}`);
  }

  public static isBigMapId(value: unknown): boolean {
    return typeof value === 'string' && /\d+/.test(value);
  }

  public async get<T>(key: Primitive): Promise<T | undefined> {
    const bigMapResponse: BigMapResponse | undefined = await RpcProvider.singleton.getBigMapValue(
      this.id.toString(),
      key
    );
    if (bigMapResponse === undefined) return undefined;

    const rawValue: unknown = this.schema?.Execute(bigMapResponse);
    return decodeMichelsonValue<T>(rawValue, this.schema);
  }
}
