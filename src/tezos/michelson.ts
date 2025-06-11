import { MichelsonMap, MichelsonMapKey, Schema } from '@taquito/michelson-encoder';
import { isIpfsLink, getFromIpfs } from '@/network/ipfs';
import { isTezosLink, getFromTezos } from '@/network/tezos-storage';
import { assert, isJson } from '@/tools/utils';

function cleanString(input: string): string {
  // Regular expression to match non-printable characters
  return input.replace(/[\x00-\x1F\x7F]/g, '');
}

function unpackMichelsonValue(value: unknown, valueSchema?: Schema): unknown {
  if (typeof value !== 'string') return value;

  if (valueSchema && 'prim' in valueSchema.val && valueSchema.val.prim) {
    switch (valueSchema.val.prim) {
      case 'bytes':
        return Buffer.from(value, 'hex').toString('utf8');
      case 'timestamp':
        return new Date(value);
      case 'nat':
      case 'int':
      case 'mutez':
        const num: number = Number(value);
        return !isNaN(num) ? num : value;
      case 'bool':
        return value === 'True' || value === 'true' || value === '1';
    }
  }

  if (MichelsonMap.isMichelsonMap(value)) {
    return unwrapMichelsonMap(value);
  }

  return value;
}

async function resolveMetadata<T = Record<string, unknown>>(uri: string, contractAddress?: string): Promise<T | null> {
  let metadataJson: unknown;
  const cleanedUri = cleanString(uri);

  // Fetch metadata from the appropriate source
  if (isIpfsLink(cleanedUri)) {
    metadataJson = await getFromIpfs(cleanedUri);
  } else if (isTezosLink(cleanedUri)) {
    metadataJson = await getFromTezos(cleanedUri, contractAddress);
  } else {
    return null; // Not a recognized metadata link
  }

  // Parse the fetched content if it's a JSON string
  if (typeof metadataJson === 'string' && isJson(metadataJson)) {
    metadataJson = JSON.parse(metadataJson);
  }

  return metadataJson as T;
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
  const valueSchema: Schema = michelsonMap['valueSchema'];

  // 1. Convert the MichelsonMap to a plain object
  for (const [key, value] of michelsonMap.entries()) {
    if (value === undefined) continue;
    assert(typeof key === 'string');

    // Recursively unwrap nested maps or unpack primitive values
    if (MichelsonMap.isMichelsonMap(value)) {
      result[key] = await unwrapMichelsonMap(value, contractAddress);
    } else {
      result[key] = unpackMichelsonValue(value, valueSchema);
    }
  }

  // 2. Handle TZIP-16 metadata link (if present)
  const metadataUri: unknown = result[''];
  if (typeof metadataUri === 'string') {
    const metadata = await resolveMetadata(metadataUri, contractAddress);

    if (metadata) {
      // Merge metadata with the on-chain map data.
      // On-chain values will overwrite off-chain metadata values in case of conflict.
      const mergedData: Record<string, unknown> = { ...metadata, ...result };
      delete mergedData['']; // Remove the metadata URI link
      return mergedData as T;
    }
  }

  return result as T;
}
