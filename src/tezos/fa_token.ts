import { ForgeParams, OpKind, ParamsWithKind, TransferParams, UnitValue } from '@taquito/taquito';
import { OperationContents } from '@taquito/rpc';

import { applyEstimates } from '@/tezos/transaction';
import { TezosRpc } from '@/tezos/provider';
import { assert } from '@/tools/utils';

function isFA12(token: FA): token is FA12 {
  return 'getBalance' in token.views && 'getTotalSupply' in token.views;
}

function isFA2(token: FA): token is FA2 {
  return 'balance_of' in token.views;
}

/**
 * Retrieves the balance of a given token for a specified address.
 *
 * Supports both FA1.2 and FA2 token standards. For FA1.2 tokens, it calls the `getBalance` view.
 * For FA2 tokens, it calls the `balance_of` view with the provided `tokenId`.
 *
 * @param token - The token contract instance, expected to conform to either FA1.2 or FA2 interface.
 * @param address - The address whose token balance is to be retrieved.
 * @param tokenId - (Optional) The token ID for FA2 tokens. Defaults to 0.
 * @returns A promise that resolves to the balance as a `BigNumber`.
 * @throws If the token does not support a balance view.
 */
export async function getTokenBalance(token: FA, address: string, tokenId = 0): Promise<BigNumber> {
  if (isFA12(token)) {
    return token.views.getBalance(address).read();
  }

  if (isFA2(token)) {
    return token.views.balance_of([{ owner: address, token_id: tokenId }]).read();
  }

  throw new Error('Token does not have a balance view');
}

/**
 * Retrieves the total supply of an FA1.2 token.
 *
 * @param token - The FA1.2 token instance for which to fetch the total supply.
 * @returns A promise that resolves to the total supply as a `BigNumber`.
 * @throws If the provided token is not an FA1.2 token.
 */
export async function getTokenSupply(token: FA12): Promise<BigNumber> {
  assert(isFA12(token), 'Token must be an FA1.2 token to get total supply');
  return token.views.getTotalSupply(UnitValue).read();
}

async function prepareTokenTransfers(token: FA, from: string, recipients: TokenRecipient[]): Promise<TransferParams[]> {
  if (isFA12(token)) {
    return recipients
      .map(({ to, amount }) => token.methodsObject.transfer({ from, to, value: amount }))
      .map((tx): TransferParams => tx.toTransferParams());
  }

  if (isFA2(token)) {
    const payload: Txs[] = recipients.map(({ to, amount, tokenId }) => ({ to_: to, token_id: tokenId ?? 0, amount }));

    const transactions: TransferParams = token.methodsObject
      .transfer([{ from_: from, txs: payload }])
      .toTransferParams();

    return [transactions];
  }

  throw new Error('Token does not have a transfer method');
}

/**
 * Creates a token transaction operation for a given FA token.
 *
 * Prepares transfer parameters for the specified recipients, applies fee/gas/storage estimates,
 * and returns the operation contents along with the current branch hash.
 *
 * @param token - The FA token instance to use for the transaction.
 * @param source - The address initiating the transaction.
 * @param recipients - An array of recipient objects specifying destination addresses and amounts.
 * @returns A promise that resolves to the forge parameters containing the operation contents and branch hash.
 */
export async function createTokenTransaction(
  token: FA,
  source: string,
  recipients: TokenRecipient[]
): Promise<ForgeParams> {
  const transactions: TransferParams[] = await prepareTokenTransfers(token, source, recipients);
  const partialParams: ParamsWithKind[] = transactions.map((tx) => ({ ...tx, kind: OpKind.TRANSACTION }));
  const contents: OperationContents[] = await applyEstimates(source, partialParams);

  const branch: string = await TezosRpc().getBlockHash();
  return { contents, branch };
}
