import { OpKind, ParamsWithKind, TransferParams, withKind } from '@taquito/taquito';
import { MichelsonMap } from '@taquito/michelson-encoder';

import { unwrapMichelsonMap } from '@/tezos/michelson';
import { getStorage, Storage } from '@/tezos/storage';
import { BigMap } from '@/tezos/storage';
import Tezos from '@/tezos/provider';

function isFA12(token: FA): token is FA12 {
  return 'getBalance' in token.views && 'getTotalSupply' in token.views;
}

function isFA2(token: FA): token is FA2 {
  return 'balance_of' in token.views;
}

async function getFaContract<T extends FA = FA>(address: string): Promise<T> {
  return (await Tezos().contract.at(address)) as T;
}

export async function getFa2TokenBalances(
  contractAddress: string,
  owners: { owner: string; tokenId: number }[]
): Promise<Fa2Balance[]> {
  const tokenContract: FA2 = await getFaContract(contractAddress);

  const balances: Fa2Balance[] = await tokenContract.views
    .balance_of(owners.map(({ owner, tokenId }) => ({ owner, token_id: tokenId })))
    .read();
  return balances;
}

export async function getTokenBalance(contractAddress: string, owner: string, tokenId: number = 0): Promise<BigNumber> {
  const tokenContract: FA = await getFaContract(contractAddress);

  if (isFA12(tokenContract)) {
    const balance: BigNumber = await tokenContract.views.getBalance(owner).read();
    return balance;
  }

  if (isFA2(tokenContract)) {
    const balance: Fa2Balance[] = await getFa2TokenBalances(contractAddress, [{ owner, tokenId }]);
    return balance[0]?.balance ?? BigNumber(0);
  }

  throw new Error('Token does not have a balance view');
}

function transferParamsToTransaction(
  source: string,
  params: TransferParams
): withKind<ParamsWithKind, OpKind.TRANSACTION> {
  return { ...params, source, kind: OpKind.TRANSACTION };
}

export async function createFa2TokenTransactions(
  contractAddress: string,
  source: string,
  recipients: { to: string; amount: BigNumber; tokenId: number }[]
) {
  const tokenContract: FA2 = await getFaContract(contractAddress);

  const transferParams: TransferParams = tokenContract.methodsObject
    .transfer([
      { from_: source, txs: recipients.map(({ to, amount, tokenId }) => ({ to_: to, amount, token_id: tokenId })) },
    ])
    .toTransferParams();

  return transferParamsToTransaction(source, transferParams);
}

export async function createTokenTransaction(
  contractAddress: string,
  source: string,
  to: string,
  amount: BigNumber,
  tokenId: number = 0
): Promise<withKind<ParamsWithKind, OpKind.TRANSACTION>> {
  const tokenContract: FA = await getFaContract(contractAddress);

  if (isFA12(tokenContract)) {
    const params: TransferParams = tokenContract.methodsObject
      .transfer({ from: source, to, value: amount })
      .toTransferParams();
    return transferParamsToTransaction(source, params);
  }

  if (isFA2(tokenContract)) {
    return createFa2TokenTransactions(contractAddress, source, [{ to, amount, tokenId }]);
  }

  throw new Error('Token does not have a transfer method');
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
