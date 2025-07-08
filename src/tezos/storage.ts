import { MichelsonMap, Schema, Token } from '@taquito/michelson-encoder';
import { BigMapResponse, ContractResponse, ScriptResponse } from '@taquito/rpc';
import { BigNumber } from 'bignumber.js';

import { decodeMichelsonValue } from '@/tezos/codec';
import { Blockchain } from '@/tezos/provider';
import { assert, isJson } from '@/tools/utils';

import { tezosStorageUri } from '@public/constants/regex.json';

export class TezosStorage {
  private static readonly TEZOS_STORAGE_REGEX: RegExp = new RegExp(tezosStorageUri);

  private readonly schema: Schema;
  private readonly storage: unknown;

  constructor(public readonly address: string, script: ScriptResponse) {
    this.schema = Schema.fromRPCResponse({ script });
    this.storage = this.schema.Execute(script.storage);
  }

  public static isTezosLink(uri: string): boolean {
    return TezosStorage.TEZOS_STORAGE_REGEX.test(uri);
  }

  public static normalizeTezosUri(uri: string, defaultAddress?: string): string {
    const match: RegExpExecArray | null = TezosStorage.TEZOS_STORAGE_REGEX.exec(uri);
    assert(match, `Invalid Tezos storage URI: ${uri}`);

    const [, address, path] = match;
    const contractAddress: string | undefined = address || defaultAddress;
    assert(contractAddress !== undefined, `No contract address found in URI or default: ${uri}`);

    let normalizedUri: string = `tezos-storage://${contractAddress}`;
    if (path) {
      normalizedUri += `/${path}`;
    }

    return normalizedUri;
  }

  public static async getFromTezos<T>(uri: string): Promise<T | undefined> {
    const match: RegExpExecArray | null = TezosStorage.TEZOS_STORAGE_REGEX.exec(uri);
    assert(match, `Invalid Tezos storage URI: ${uri}`);

    const [, address, path] = match;
    assert(address !== undefined, `No contract address found in URI or default: ${uri}`);

    const schema: ContractResponse | undefined = await Blockchain.getContractResponse(address);
    const storage: TezosStorage | undefined = new TezosStorage(address, schema!.script);
    const bigMap: BigMap | undefined = await storage?.get<BigMap>('metadata');

    let curr: unknown = bigMap;
    const segments: string[] = path ? path.split('%2F') : [];
    for (const segment of segments) {
      if (curr instanceof TezosStorage || curr instanceof BigMap) {
        curr = await curr.get(segment);
      } else if (MichelsonMap.isMichelsonMap(curr)) {
        curr = curr.get(segment);
      } else if (curr !== null && typeof curr === 'object' && segment in curr) {
        curr = (curr as { [key: string]: unknown })[segment];
      } else {
        throw new Error(`Invalid path segment '${segment}' in Tezos storage URI`);
      }
    }

    if (typeof curr === 'string' && isJson(curr)) {
      return JSON.parse(curr as string) as T;
    }

    return curr as T;
  }

  private static isBigMapId(value: unknown): boolean {
    return typeof value === 'string' && /\d+/.test(value);
  }

  private static findBigMapId(obj: object, key: string): string | undefined {
    for (const [k, val] of Object.entries(obj)) {
      if (k === key && TezosStorage.isBigMapId(val)) {
        return val;
      }

      if (typeof val === 'object' && val !== null) {
        const result: string | undefined = TezosStorage.findBigMapId(val, key);
        if (result !== undefined && TezosStorage.isBigMapId(result)) {
          return result;
        }
      }
    }

    return undefined;
  }

  public async get<T>(key: string): Promise<T | undefined> {
    if (!this.storage) {
      return undefined;
    }

    if (typeof this.storage !== 'object') {
      return this.storage as T;
    }

    // Check if the key corresponds to a big_map in the schema
    const bigMapSchema: Token | undefined = this.schema.findToken('big_map').find((t): boolean => t.annot() === key);
    if (bigMapSchema !== undefined) {
      const bigMapId: string = TezosStorage.findBigMapId(this.storage, key)!;
      const michelsonSchema: MichelsonExpression | undefined = bigMapSchema.tokenVal.args?.[1];
      const storageSchema: Schema | undefined = michelsonSchema ? new Schema(michelsonSchema) : undefined;
      return new BigMap(this.address, bigMapId, storageSchema!) as T;
    }

    return key in this.storage ? ((this.storage as Record<string, unknown>)[key] as T) : undefined;
  }
}

export class BigMap {
  private readonly _id: BigNumber;

  public get id(): BigNumber {
    return this._id;
  }

  constructor(public readonly address: string, id: BigNumber.Value, private readonly schema: Schema) {
    this._id = BigNumber(id);
    assert(/\d+/.test(this._id.toString()), `Invalid BigMap ID: ${this._id.toString()}`);
  }

  public async get<T>(key: Primitive): Promise<T | undefined> {
    const bigMapResponse: BigMapResponse | undefined = await Blockchain.getBigMapValue(this._id.toString(), key);
    if (bigMapResponse === undefined) return undefined;

    const rawValue: unknown = this.schema?.Execute(bigMapResponse);
    const final: T | undefined = await decodeMichelsonValue<T>(rawValue, this.schema);

    return final;
  }
}
