import { BigMapAbstraction, ContractAbstraction, ContractProvider } from '@taquito/taquito';
import { MichelsonMap, MichelsonMapKey } from '@taquito/michelson-encoder';

import { tezosStorageUri } from '@public/constants/regex.json';
import { unwrapMichelsonMap } from '@/tezos/michelson';
import { assert, isDefined, isJson } from '@/tools/utils';
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
    } else if (typeof curr === 'object' && isDefined(curr) && segment in curr) {
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
  const contractAddress: string | undefined = address || defaultAddress;
  assert(contractAddress !== undefined, `No contract address found in URI or default: ${uri}`);

  const contract: ContractAbstraction<ContractProvider> = await Tezos().contract.at(contractAddress);
  const storage: { metadata?: unknown } = await contract.storage();
  assert(storage['metadata'], `No 'metadata' field found in contract storage: ${contractAddress}`);

  const pathSegments: string[] = path ? path.split('%2F') : [];
  const final: unknown = await findDataInStorage(storage, pathSegments);

  if (typeof final === 'string' && isJson(final)) {
    return JSON.parse(final) as T;
  }

  return final as T;
}
