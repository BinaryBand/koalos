import { ForgeParams, OpKind, ParamsWithKind, TezosToolkit } from '@taquito/taquito';
import { OperationContents } from '@taquito/rpc';

import { addressToDomain } from './smart-contracts/defi/domains.js';
import { applyEstimates } from './chain/transactions.js';
import { FakeSigner } from '../network/taquito.js';
import Tezos from '../network/taquito.js';

/**
 * Retrieves wallet data for a given Tezos address, including balance and associated domain.
 *
 * @param address - The Tezos wallet address to query.
 * @returns A promise that resolves to a `WalletData` object containing the address, balance (in tez), and domain.
 */
export async function getWalletData(address: string): Promise<WalletData> {
  const [_balance, domain] = await Promise.all([Tezos().rpc.getBalance(address), addressToDomain(address)]);
  const balance: number = _balance.toNumber() / 1e6; // Convert from mutez to tez
  return { address, balance, domain };
}

function prepareTransfers(source: string, recipients: TezosRecipient[]): ParamsWithKind[] {
  return recipients.map(({ to, amount }) => ({ kind: OpKind.TRANSACTION, to, amount: amount.toNumber(), source }));
}

/**
 * Creates a Tezos transaction by preparing transfer parameters, estimating operation contents,
 * and returning the necessary parameters to forge the transaction.
 *
 * @param source - The address or key of the source account initiating the transaction.
 * @param recipients - An array of recipient objects specifying destination addresses and amounts.
 * @returns A promise that resolves to a `ForgeParams` object containing the operation contents and branch hash.
 *
 * @throws Will throw an error if preparing transfers or applying estimates fails.
 */
export async function createTransaction(source: string, recipients: TezosRecipient[]): Promise<ForgeParams> {
  const tezos: TezosToolkit = Tezos();
  tezos.setProvider({ signer: new FakeSigner(source) });

  const partialParams: ParamsWithKind[] = prepareTransfers(source, recipients);
  const contents: OperationContents[] = await applyEstimates(source, partialParams);

  const branch: string = await Tezos().rpc.getBlockHash();
  return { contents, branch };
}

// TODO: Create a staking operation
