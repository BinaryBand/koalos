import { BigMapAbstraction, ContractAbstraction, ContractProvider } from '@taquito/taquito';
import { MichelsonMap } from '@taquito/michelson-encoder';
import { unwrapMichelsonMap } from '@/tezos/michelson';
import Tezos from '@/tezos/provider';

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
  const contract: ContractAbstraction<ContractProvider> = await Tezos().contract.at(address);
  const storage: TZip16Storage = await contract.storage();

  const michelsonMap = new MichelsonMap();
  const metadata: BigMapAbstraction = storage.metadata;
  michelsonMap.set('', await metadata.get(''));

  if (michelsonMap.get('') === undefined) {
    michelsonMap.set('name', await metadata.get('name'));
    michelsonMap.set('description', await metadata.get('description'));
    michelsonMap.set('version', await metadata.get('version'));
  }

  const metadataSchema: MichelsonExpression = metadata['schema']['val'];
  michelsonMap.setType(metadataSchema);
  return unwrapMichelsonMap<TZip17Metadata>(michelsonMap, contract.address);
}

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
  const contract: ContractAbstraction<ContractProvider> = await Tezos().contract.at(address);
  const storage: TZip16Storage = await contract.storage();

  let tokenMetadata: BigMapAbstraction | null = 'token_metadata' in storage ? storage.token_metadata : null;
  tokenMetadata ??= 'assets' in storage ? storage.assets.token_metadata : null;

  const faTokenMetadata: Record<string, unknown> | undefined = await tokenMetadata?.get(tokenId);
  const tokenInfo: unknown = faTokenMetadata?.['token_info'] ?? faTokenMetadata?.['1'];
  if (MichelsonMap.isMichelsonMap(tokenInfo)) {
    return unwrapMichelsonMap<TZip21TokenMetadata>(tokenInfo);
  }

  return tokenInfo as TZip21TokenMetadata | undefined;
}
