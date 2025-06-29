import { Schema, Token } from '@taquito/michelson-encoder';
import { BigMapResponse, ScriptedContracts } from '@taquito/rpc';

import { isIpfsLink, getFromIpfs } from '@/network/ipfs';
import { isTezosLink, normalizeTezosUri, getFromTezos } from '@/network/tezos';

import { decodeMichelsonValue } from '@/tezos/michelson';
import { getBigMapValue, getScript } from '@/tezos/provider';
import { assert, isJson } from '@/tools/utils';

function isBigMapId(value: unknown): boolean {
  return typeof value === 'string' && /\d+/.test(value);
}

function findBigMapId(obj: object, key: string): string | undefined {
  for (const [k, val] of Object.entries(obj)) {
    if (k === key && isBigMapId(val)) return val;

    if (typeof val === 'object' && val !== null) {
      const result: string | undefined = findBigMapId(val, key);
      if (isBigMapId(result)) return result;
    }
  }

  return undefined;
}

export async function getStorage(address: string): Promise<Storage | undefined> {
  const script: ScriptedContracts = (await getScript(address))!;
  const contractSchema: Schema = Schema.fromRPCResponse({ script });
  const storageResponse: StorageResponse = contractSchema.Execute(script.storage);
  return new Storage(storageResponse, address, contractSchema);
}

export class Storage implements IStorage {
  constructor(
    private readonly storage: StorageResponse,
    private readonly address: string,
    private readonly schema: Schema
  ) {}

  public async getValue<T>(key: string): Promise<T | undefined> {
    const bigMapSchema: Token | undefined = this.schema.findToken('big_map').find((t): boolean => t.annot() === key);

    if (bigMapSchema !== undefined) {
      const bigMapId: string | undefined = findBigMapId(this.storage, key);

      if (bigMapId && isBigMapId(bigMapId)) {
        const michelson: MichelsonExpression | undefined = bigMapSchema.tokenVal.args?.[1];
        const schema: Schema | undefined = michelson ? new Schema(michelson) : undefined;
        return new BigMap(bigMapId, this.address, schema) as T;
      }
    }

    return this.storage[key] as T;
  }
}

function cleanString(input: string): string {
  return input.replace(/[\x00-\x1F\x7F]/g, '');
}

async function resolvePossibleLink<T>(value: string, contractAddress?: string): Promise<T | undefined> {
  value = cleanString(value);

  if (isIpfsLink(value)) {
    return getFromIpfs<T>(value);
  } else if (isTezosLink(value)) {
    const normalizedUri: string = normalizeTezosUri(value, contractAddress);
    return getFromTezos<T>(normalizedUri);
  }

  if (isJson(value)) {
    return JSON.parse(value);
  }

  return value as T;
}

export class BigMap implements IStorage {
  constructor(private readonly id: string, private readonly address: string, private readonly schema?: Schema) {
    assert(/\d+/.test(id), `Invalid BigMap ID: ${id}`);
  }

  public async getValue<T>(key: Primitive): Promise<T | undefined> {
    const bigMapResponse: BigMapResponse | undefined = await getBigMapValue(this.id, key);
    if (bigMapResponse === undefined) return undefined;

    const rawValue: unknown = this.schema?.Execute(bigMapResponse);
    const final: T | undefined = await decodeMichelsonValue<T>(rawValue, this.schema);

    if (typeof final === 'string') {
      const resolved = await resolvePossibleLink<T>(final, this.address);
      return resolved !== undefined ? resolved : final;
    }

    return final;
  }
}
