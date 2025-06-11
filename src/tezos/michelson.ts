import { BigMapAbstraction, ContractAbstraction, ContractProvider } from '@taquito/taquito';
import { MichelsonMap, MichelsonMapKey, Schema } from '@taquito/michelson-encoder';
import { isIpfsLink, getFromIpfs } from '@/network/ipfs';

import { tezosStorageUri } from '@public/constants/regex.json';
import { assert, isJson } from '@/tools/utils';
import Tezos from '@/tezos/provider';

// --- Constants ---
const TEZOS_STORAGE_REGEX: RegExp = new RegExp(tezosStorageUri);

/**
 * Determines whether a given URI matches the Tezos storage URI pattern.
 *
 * @param uri - The URI string to test.
 * @returns `true` if the URI matches the Tezos storage URI pattern; otherwise, `false`.
 */
export function isTezosLink(uri: string): boolean {
  return TEZOS_STORAGE_REGEX.test(uri);
}

async function findDataInStorage(data: { metadata?: unknown }, segments: string[]): Promise<unknown> {
  const pathSegments: string[] = segments;

  let curr: unknown = data['metadata'];
  for (const segment of pathSegments) {
    if (curr instanceof BigMapAbstraction) {
      const michelsonMap: MichelsonMap<MichelsonMapKey, unknown> = await curr.getMultipleValues([segment]);
      michelsonMap.setType(curr['schema'].val);
      curr = (await unwrapMichelsonMap(michelsonMap))[segment];
    } else if (MichelsonMap.isMichelsonMap(curr)) {
      curr = curr.get(segment);
    } else if (typeof curr === 'object' && curr !== null && segment in curr) {
      curr = (curr as { [segment]: unknown })[segment];
    } else {
      throw new Error(`Invalid path segment '${segment}' in Tezos storage URI`);
    }
  }

  return curr;
}

/**
 * Retrieves data from a Tezos smart contract's storage using a tezos-storage URI.
 * https://tzip.tezosagora.org/proposal/tzip-16/#the-tezos-storage-uri-scheme
 *
 * This function parses the provided URI to extract the contract address and storage path,
 * fetches the contract's storage, and returns the requested data. If the storage contains
 * a "metadata" field, it attempts to retrieve the value at the specified path or entrypoint.
 *
 * @template T - The expected return type of the data.
 * @param uri - The tezos-storage URI specifying the contract and storage path.
 * @param defaultAddress - An optional default contract address to use if not specified in the URI.
 * @returns A promise that resolves to the requested data from the contract's storage.
 * @throws If the URI is invalid or a contract address cannot be determined.
 */
export async function getFromTezos<T = unknown>(uri: string, defaultAddress?: string): Promise<T> {
  const match = TEZOS_STORAGE_REGEX.exec(uri);
  assert(match, `Invalid Tezos storage URI: ${uri}`);

  const [, address, path] = match;
  const contractAddress: string | null = address || defaultAddress || null;
  assert(contractAddress !== null, `No contract address found in URI or default: ${uri}`);

  const contract: ContractAbstraction<ContractProvider> = await Tezos().contract.at(contractAddress);
  const storage: { metadata?: unknown } = await contract.storage();
  assert(storage['metadata'] !== undefined, `No 'metadata' field found in contract storage: ${contractAddress}`);

  const pathSegments: string[] = path ? path.split('%2F') : [];
  return findDataInStorage(storage, pathSegments) as T;
}

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
