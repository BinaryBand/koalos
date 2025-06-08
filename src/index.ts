import 'dotenv/config';

import { ContractAbstraction, ContractProvider, TezosToolkit } from '@taquito/taquito';
import Tezos from '@/tezos/provider';

async function main() {
  const tezos: TezosToolkit = Tezos();

  const address: string = process.env['VIEW_ADDRESS']!;
  console.log(`Tezos address: ${address}`);
  console.log('Balance:', await tezos.rpc.getBalance(address));
  console.log('Delegate:', await tezos.rpc.getDelegate(address));
}

main()
  .then(async () => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
