import { BytesLiteral, MichelsonData, MichelsonType, packDataBytes } from '@taquito/michel-codec';
import { MichelsonMap, MichelsonMapKey, Schema } from '@taquito/michelson-encoder';
import { b58cencode, prefix } from '@taquito/utils';
import { blake2b } from '@noble/hashes/blake2';
import { BigNumber } from 'bignumber.js';
import { assert } from '@/tools/utils';

export function pack(data: MichelsonData, type?: MichelsonType): BytesLiteral {
  return packDataBytes(data, type);
}

export function toPacked(data: Primitive, prim?: 'address' | 'string' | 'int' | 'nat' | 'bool'): BytesLiteral {
  if (typeof data === 'string') {
    assert(prim === undefined || prim === 'address' || prim === 'string', 'Invalid type for string');
    return pack({ string: data }, { prim: prim ?? 'string' });
  }

  if (typeof data === 'number') {
    assert(prim === undefined || prim === 'int' || prim === 'nat', 'Invalid type for number');
    return pack({ int: data.toString() }, { prim: prim ?? 'int' });
  }

  if (typeof data === 'boolean') {
    assert(prim === undefined || prim === 'bool', 'Invalid type for boolean');
    return pack({ prim: data ? 'True' : 'False' }, { prim: prim ?? 'bool' });
  }

  return pack({ string: data });
}

export function toExpr(data: Primitive, prim?: 'address' | 'string' | 'int' | 'nat' | 'bool'): string {
  const { bytes } = toPacked(data, prim);
  const hash: Uint8Array = blake2b(Buffer.from(bytes, 'hex'), { dkLen: 32 });
  return b58cencode(hash, prefix.expr);
}

export function addressToExpr(address: string): string {
  return toExpr(address, 'address');
}

/**
 * Decodes a Michelson value using an optional schema.
 *
 * If a schema is provided, the function attempts to encode the input value using the schema,
 * then decodes the resulting Michelson expression based on its type:
 * - If the expression contains a `bytes` property, it decodes the bytes as a UTF-8 string.
 * - If the expression contains an `int` property, it converts it to a JavaScript number.
 * - If the expression contains a `string` property, it returns the string value.
 * - If the value is a MichelsonMap, it sets the map's type and unwraps it.
 *
 * If no schema is provided or decoding is not possible, the original value is returned.
 *
 * @param value - The Michelson value to decode.
 * @param schema - (Optional) The schema used to encode and decode the value.
 * @returns The decoded value, or the original value if decoding is not possible.
 */
export function decodeMichelsonValue<T>(value: unknown, schema?: Schema): T | undefined {
  if (schema !== undefined) {
    const michelson: MichelsonExpressionBase = schema.Encode(value);
    if ('bytes' in michelson) {
      return Buffer.from(michelson.bytes, 'hex').toString('utf8') as T;
    } else if ('int' in michelson) {
      const num: BigNumber = BigNumber(michelson.int);
      return (num.isNaN() ? value : num) as T;
    } else if ('string' in michelson) {
      return michelson.string as T;
    }

    if (MichelsonMap.isMichelsonMap(value)) {
      value.setType(schema.val);
      return unwrapMichelsonMap(value) as T;
    }
  }

  return value as T;
}

/**
 * Recursively unwraps a `MichelsonMap` into a plain JavaScript object, converting nested maps and unpacking primitive values.
 *
 * - If a value in the map is itself a `MichelsonMap`, it is recursively unwrapped.
 * - If a value is a primitive, it is unpacked using the provided schema.
 * - If the map contains a TZIP-16 metadata URI (under the empty string key), the metadata is fetched and merged with the map data.
 *   On-chain values will overwrite off-chain metadata values in case of conflict.
 *
 * @template T - The expected output object type.
 * @param michelsonMap - The MichelsonMap to unwrap.
 * @param contractAddress - (Optional) The contract address, used for resolving TZIP-16 metadata if present.
 * @returns A promise that resolves to the unwrapped object of type `T`.
 */
export function unwrapMichelsonMap<T extends Record<string, unknown>>(
  michelsonMap: MichelsonMap<MichelsonMapKey, unknown>,
  contractAddress?: string
): T {
  const result: Record<string, unknown> = {};
  const valueSchema: Schema | undefined = michelsonMap['valueSchema'];

  for (const [key, value] of michelsonMap.entries()) {
    if (value === undefined) continue;
    assert(typeof key === 'string');

    // Recursively unwrap nested maps or unpack primitive values
    if (MichelsonMap.isMichelsonMap(value)) {
      result[key] = unwrapMichelsonMap(value, contractAddress);
    } else if (valueSchema !== undefined) {
      result[key] = decodeMichelsonValue(value, valueSchema);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
