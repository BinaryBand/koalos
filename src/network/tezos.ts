import { MichelsonMap } from '@taquito/taquito';

import { getStorage, Storage } from '@/tezos/storage';
import { BigMap } from '@/tezos/storage';
import { assert } from '@/tools/utils';

import { tezosStorageUri } from '@public/constants/regex.json';

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

/**
 * Normalizes a Tezos storage URI by ensuring it includes a contract address and is in the correct format.
 *
 * The function parses the given `uri` using the `TEZOS_STORAGE_REGEX` regular expression to extract the contract address and optional path.
 * If the contract address is not present in the URI, it uses the provided `defaultAddress`.
 * Throws an error if the URI is invalid or if no contract address can be determined.
 *
 * @param uri - The Tezos storage URI to normalize.
 * @param defaultAddress - An optional default contract address to use if the URI does not contain one.
 * @returns The normalized Tezos storage URI in the format `tezos-storage://<contractAddress>[/<path>]`.
 * @throws Will throw an error if the URI is invalid or if no contract address is found.
 */
export function normalizeTezosUri(uri: string, defaultAddress?: string): string {
  const match: RegExpExecArray | null = TEZOS_STORAGE_REGEX.exec(uri);
  assert(match, `Invalid Tezos storage URI: ${uri}`);

  const [, address, path] = match;
  const contractAddress: string | undefined = address || defaultAddress;
  assert(contractAddress !== undefined, `No contract address found in URI or default: ${uri}`);

  let normalizedUri = `tezos-storage://${contractAddress}`;
  if (path) {
    normalizedUri += `/${path}`;
  }

  return normalizedUri;
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
export async function getFromTezos<T>(uri: string): Promise<T | undefined> {
  const match: RegExpExecArray | undefined = TEZOS_STORAGE_REGEX.exec(uri) ?? undefined;
  assert(match, `Invalid Tezos storage URI: ${uri}`);

  const [, address, path] = match;
  assert(address !== undefined, `No contract address found in URI or default: ${uri}`);

  const storage: Storage | undefined = await getStorage(address);
  const bigMap: BigMap | undefined = await storage?.getValue<BigMap>('metadata');

  let curr: unknown = bigMap;
  const segments: string[] = path ? path.split('%2F') : [];
  for (const segment of segments) {
    if (curr instanceof Storage || curr instanceof BigMap) {
      curr = await curr.getValue(segment);
    } else if (MichelsonMap.isMichelsonMap(curr)) {
      curr = curr.get(segment);
    } else if (curr !== null && typeof curr === 'object' && segment in curr) {
      curr = (curr as { [key: string]: unknown })[segment];
    } else {
      throw new Error(`Invalid path segment '${segment}' in Tezos storage URI`);
    }
  }

  return curr as T;
}
