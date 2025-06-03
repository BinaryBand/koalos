import {
  ContractMethodObject,
  ContractProvider,
  Estimate,
  OpKind,
  ParamsWithKind,
  TransferParams,
  UnitValue,
  WalletOperationBatch,
  WalletParamsWithKind,
} from '@taquito/taquito';
import { BatchWalletOperation } from '@taquito/taquito/dist/types/wallet/batch-operation.js';
import { assert } from '../../../tools/misc.js';
import Tezos from '../../../network/taquito.js';

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
export async function getTokenBalance(token: FA, address: string, tokenId: number = 0): Promise<BigNumber> {
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
    const transactions: TransferParams[] = recipients
      .map(({ to, amount }) => token.methodsObject.transfer({ from, to, value: amount }))
      .map((tx: ContractMethodObject<ContractProvider>): TransferParams => tx.toTransferParams());

    return transactions;
  }

  if (isFA2(token)) {
    const payload: Txs[] = recipients.map(({ to, amount, tokenId }) => {
      return { to_: to, token_id: tokenId ?? 0, amount };
    });

    const transactions: TransferParams = token.methodsObject
      .transfer([{ from_: from, txs: payload }])
      .toTransferParams();

    return [transactions];
  }

  throw new Error('Token does not have a transfer method');
}

/**
 * Estimates the gas and storage costs for a batch of token transfer operations.
 *
 * @param token - The FA (fungible asset) token contract instance to use for transfers.
 * @param from - The address initiating the transfers.
 * @param recipients - An array of recipient addresses and amounts for the transfers.
 * @returns A promise that resolves to an array of `Estimate` objects, each representing the estimated cost for a corresponding transfer.
 *
 * @throws Will throw if preparing the token transfers or estimating the batch fails.
 */
export async function estimateTokenTransfers(
  token: FA,
  from: string,
  recipients: TokenRecipient[]
): Promise<Estimate[]> {
  const transactions: TransferParams[] = await prepareTokenTransfers(token, from, recipients);
  const batchParams: ParamsWithKind[] = transactions.map(tx => ({ ...tx, kind: OpKind.TRANSACTION }));
  const estimates: Estimate[] = await Tezos().estimate.batch(batchParams);
  return estimates;
}

/**
 * Sends tokens from a specified address to multiple recipients using a batch operation.
 *
 * @param token - The FA (fungible asset) token contract instance to use for transfers.
 * @param from - The address from which tokens will be sent.
 * @param recipients - An array of recipient addresses and amounts to receive tokens.
 * @returns A promise that resolves to a `BatchWalletOperation` representing the sent batch transaction.
 *
 * @throws Will throw if preparing token transfers or sending the batch fails.
 */
export async function sendTokens(token: FA, from: string, recipients: TokenRecipient[]): Promise<BatchWalletOperation> {
  const transactions: TransferParams[] = await prepareTokenTransfers(token, from, recipients);
  const batchParams: WalletParamsWithKind[] = transactions.map(tx => ({ ...tx, kind: OpKind.TRANSACTION }));
  const batch: WalletOperationBatch = Tezos().wallet.batch(batchParams);
  return batch.send();
}
