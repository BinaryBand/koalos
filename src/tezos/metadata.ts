import { MichelsonMap } from '@taquito/michelson-encoder';
import { unwrapMichelsonMap } from '@/tezos/michelson';
import { getStorage, Storage } from '@/tezos/storage';
import { BigMap } from '@/tezos/storage';

/**
 * Retrieves the metadata for a specific token from a smart contract.
 *
 * This function attempts to access the `token_metadata` big map from the contract's storage,
 * falling back to `assets.token_metadata` if necessary. It then fetches the metadata for the
 * specified `tokenId`, unwraps the Michelson map if present, and returns the token metadata
 * in the TZip21 format.
 *
 * @param address - The contract abstraction instance to query.
 * @param tokenId - The ID of the token whose metadata is to be retrieved. Defaults to 0.
 * @returns A promise that resolves to the token metadata in TZip21 format, or `undefined` if not found.
 */
export async function getTokenMetadata(address: string, tokenId: number = 0): Promise<TZip21TokenMetadata | undefined> {
  const storage: Storage | undefined = await getStorage(address);
  const bigMap: BigMap | undefined = await storage?.getValue<BigMap>('token_metadata');

  const tokenMetadata: TokenMetadata | undefined = await bigMap?.getValue(tokenId);
  const tokenInfo: unknown = tokenMetadata?.['token_info'] ?? tokenMetadata?.['1'];

  if (MichelsonMap.isMichelsonMap(tokenInfo)) {
    return unwrapMichelsonMap<TZip21TokenMetadata>(tokenInfo);
  }

  return tokenInfo as TZip21TokenMetadata;
}

/**
 * Retrieves and unwraps the TZIP-17 metadata for a given smart contract.
 *
 * This function fetches the contract's storage, accesses the metadata big map,
 * retrieves multiple standard TZIP-16 metadata fields, and, if the result is a MichelsonMap,
 * applies the schema and unwraps the map into a strongly-typed TZip17Metadata object.
 *
 * @param address - The contract abstraction instance to fetch metadata from.
 * @returns A promise that resolves to the unwrapped TZip17Metadata object if available, or `undefined` otherwise.
 */
export async function getMetadata(address: string): Promise<TZip17Metadata | undefined> {
  const storage: Storage | undefined = await getStorage(address);
  const bigMap: BigMap | undefined = await storage?.getValue<BigMap>('metadata');

  const final: TZip17Metadata | undefined = await bigMap?.getValue<TZip17Metadata>('');
  if (final !== undefined) {
    return final;
  }

  // If the metadata is not a MichelsonMap, we try to access the standard fields directly
  const [name, description, version] = await Promise.all([
    bigMap?.getValue<string>('name'),
    bigMap?.getValue<string>('description'),
    bigMap?.getValue<string>('version'),
  ]);

  return { name, description, version } as TZip17Metadata;
}
