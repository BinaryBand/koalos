import { BigMapAbstraction, ContractAbstraction, ContractProvider } from '@taquito/taquito';
import { MichelsonMap, MichelsonMapKey, Schema } from '@taquito/michelson-encoder';

import { tezosStorageUri } from '@public/constants/regex.json';
import { assert } from '@/tools/utils';
import Tezos from '@/tezos/provider';

/**
 * Determines whether a given URI matches the Tezos storage URI pattern.
 *
 * @param uri - The URI string to test.
 * @returns `true` if the URI matches the Tezos storage URI pattern; otherwise, `false`.
 */
export function isTezosLink(uri: string): boolean {
  return new RegExp(tezosStorageUri).test(uri);
}

// https://tzip.tezosagora.org/proposal/tzip-16/#the-tezos-storage-uri-scheme
// TODO: Handle paths with multiple segments, e.g. "tezos-storage://tz1.../entrypoint/segment"
/**
 * Retrieves data from a Tezos smart contract's storage using a tezos-storage URI.
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
  const [match, address, path] = new RegExp(tezosStorageUri).exec(uri) ?? [];
  assert(match !== undefined, `Invalid Tezos link: ${uri}`);

  const addressToUse: string | undefined = address ?? defaultAddress;
  assert(addressToUse !== undefined, `Tezos link must specify a contract address or provide a default address: ${uri}`);

  const contract: ContractAbstraction<ContractProvider> = await Tezos().contract.at(addressToUse);
  const storage: { metadata?: unknown } = await contract.storage();

  // If storage does not have a "metadata" member, return it as is
  let schema: MichelsonExpression = contract.schema.val;
  if (!storage.metadata) {
    return storage as T;
  }

  // Update schema root to the 'metadata' schema if it exists
  let rawData: unknown = storage['metadata'];
  if (rawData && typeof rawData === 'object' && 'schema' in rawData) {
    schema = (rawData.schema as Schema).val;
  }

  const segments: string[] = path ? path.split('%2') : [];
  const entrypoint: string | undefined = segments.pop();

  // If an entrypoint is specified, get the value for that entrypoint
  if (rawData instanceof BigMapAbstraction) {
    const michelsonMap: MichelsonMap<MichelsonMapKey, unknown> = await rawData.getMultipleValues([entrypoint ?? '']);

    // Ensure the schema is set in case the user wants to unwrap it later
    if (schema !== undefined && schema !== null && MichelsonMap.isMichelsonMap(michelsonMap)) {
      michelsonMap.setType(schema);
    }

    rawData = michelsonMap.get(entrypoint ?? '');
  }

  return rawData as T;
}
