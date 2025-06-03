import { Estimate, ForgeParams, OpKind, ParamsWithKind, PreparedOperation } from '@taquito/taquito';
import { OperationContentsTransaction, OperationContentsAndResult } from '@taquito/rpc';

import { getTezosToUsdt } from '../tools/explorers/defi/quipuswap.js';
import { addressToDomain } from '../tools/explorers/defi/domains.js';
import Tezos from '../network/taquito.js';

// Metadata on Tezos
export async function getOmniWallet(): Promise<OmniWallet> {
  const price: number = await getTezosToUsdt();
  return { price };
}

export async function getMetaWallet(address: string): Promise<MetaWallet> {
  const [balance, domain] = await Promise.all([Tezos().rpc.getBalance(address), addressToDomain(address)]);

  return {
    address,
    balance: balance.toNumber() / 1e6, // Convert from mutez to tez
    domain,
  };
}

function prepareTransfers(source: string, recipients: TezosRecipient[]): ParamsWithKind[] {
  return recipients.map(({ to, amount }) => ({
    kind: OpKind.TRANSACTION,
    to,
    amount: amount.toNumber(),
    source,
  }));
}

export async function estimateTransfers(source: string, recipients: TezosRecipient[]): Promise<Estimate[]> {
  const params: ParamsWithKind[] = prepareTransfers(source, recipients);
  const estimates: Estimate[] = await Tezos().estimate.batch(params);
  return estimates;
}

export async function sendTezos(source: string, recipients: TezosRecipient[]): Promise<ForgeParams> {
  const partialParams: ParamsWithKind[] = prepareTransfers(source, recipients);

  console.log((await Tezos().rpc.getConstants()).hard_gas_limit_per_operation);

  const { counter } = await Tezos().rpc.getContract(source);
  let curr: number = parseInt(counter ?? '0', 10);

  console.log('Counter for source:', counter);

  const operationContentsTransactions: OperationContentsTransaction[] = recipients.map((rec: TezosRecipient) => ({
    kind: OpKind.TRANSACTION,
    source,
    fee: '500',
    gas_limit: '0',
    storage_limit: '0',
    amount: rec.amount.toString(),
    destination: rec.to,
    counter: `${++curr}`,
  }));

  const [branch, protocol]: [string, string] = await Tezos()
    .rpc.getBlockHeader()
    .then(header => [header.hash, header.protocol]);

  const preparedOperation: PreparedOperation = {
    opOb: {
      branch,
      contents: operationContentsTransactions,
      protocol,
    },
    counter: parseInt(counter ?? '0', 10),
  };
  console.log('Test operation:', JSON.stringify(preparedOperation, null, 2));

  const batchOp: PreparedOperation = await Tezos().prepare.batch(partialParams);
  console.log('Control operation:', JSON.stringify(batchOp, null, 2));

  const params: ForgeParams = Tezos().prepare.toForge(batchOp);
  return params;
}
