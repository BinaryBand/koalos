import 'module-alias/register';
import 'dotenv/config';

import { TezosToolkit } from '@taquito/taquito';
import { InMemorySigner } from '@taquito/signer';

import CODE from '@public/contracts/receive-balance/code.json';
import STORAGE from '@public/contracts/receive-balance/storage.json';

const RPC_URLS: string[] = [
  'https://mainnet.tezos.ecadinfra.com/',
  'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
];

const RPC: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
const Tezos: TezosToolkit = new TezosToolkit(RPC);

Tezos.setProvider({
  signer: new InMemorySigner(process.env['SECRET_KEY']!),
});

async function main(): Promise<void> {
  const origin = await Tezos.contract.originate({ code: CODE, init: STORAGE });
  console.log('Originated contract address:', origin.contractAddress);
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    console.log('RPC URL:', RPC);
    process.exit(1);
  });
