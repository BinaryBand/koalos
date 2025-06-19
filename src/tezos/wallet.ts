import { OpKind, ParamsWithKind } from '@taquito/taquito';
import { OperationContents } from '@taquito/rpc';

import { applyEstimates } from '@/tezos/transaction';
import { TezosRpc } from '@/tezos/provider';

function addressToDomain(address: string): Promise<string> {
  // Placeholder for the actual implementation of address to domain conversion
  return Promise.resolve(`domain-for-${address}`);
}

/**
 * Retrieves wallet data for a given Tezos address, including balance and associated domain.
 *
 * @param address - The Tezos wallet address to query.
 * @returns A promise that resolves to a `WalletData` object containing the address, balance (in tez), and domain.
 */
export async function getWalletData(address: string): Promise<WalletData> {
  const [_balance, domain] = await Promise.all([TezosRpc().getBalance(address), addressToDomain(address)]);
  const balance: number = _balance.toNumber() / 1e6; // Convert from mutez to tez
  return { address, balance, domain };
}

function prepareTransfers(source: string, recipients: TezosRecipient[]): ParamsWithKind[] {
  return recipients.map(({ to, amount }) => ({ kind: OpKind.TRANSACTION, to, amount: amount.toNumber(), source }));
}

/**
 * Creates a Tezos transaction operation from a source address to one or more recipients.
 *
 * Initializes a TezosToolkit instance with a custom signer for the given source,
 * prepares transfer parameters for the specified recipients, and applies fee/gas estimates.
 *
 * @param source - The address or key of the transaction source.
 * @param recipients - An array of recipient objects specifying destination addresses and amounts.
 * @returns A promise that resolves to an array of operation contents representing the transaction(s).
 */
export async function createTransaction(source: string, recipients: TezosRecipient[]): Promise<OperationContents[]> {
  const partialParams: ParamsWithKind[] = prepareTransfers(source, recipients);
  return applyEstimates(source, partialParams);
}

// TODO: Create a staking operation
