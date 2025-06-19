import { MichelsonMap, MichelsonMapKey, Schema } from '@taquito/michelson-encoder';
import { assert } from '@/tools/utils';

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
export function decodeMichelsonValue(value: unknown, schema?: Schema): unknown {
  if (schema) {
    const michelson: MichelsonExpressionBase = schema.Encode(value);
    if ('bytes' in michelson && michelson.bytes) {
      return Buffer.from(michelson.bytes, 'hex').toString('utf8');
    } else if ('int' in michelson && michelson.int) {
      const num: number = Number(michelson.int);
      return !isNaN(num) ? num : value;
    } else if ('string' in michelson && michelson.string) {
      return michelson.string;
    }

    if (MichelsonMap.isMichelsonMap(value)) {
      value.setType(schema.val);
      return unwrapMichelsonMap(value);
    }
  }

  return value;
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
export async function unwrapMichelsonMap<T extends Record<string, unknown>>(
  michelsonMap: MichelsonMap<MichelsonMapKey, unknown>,
  contractAddress?: string
): Promise<T> {
  const result: Record<string, unknown> = {};
  const valueSchema: Schema | undefined = michelsonMap['valueSchema'];

  for (const [key, value] of michelsonMap.entries()) {
    if (value === undefined) continue;
    assert(typeof key === 'string');

    // Recursively unwrap nested maps or unpack primitive values
    if (MichelsonMap.isMichelsonMap(value)) {
      result[key] = await unwrapMichelsonMap(value, contractAddress);
    } else if (valueSchema !== undefined) {
      result[key] = decodeMichelsonValue(value, valueSchema);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
