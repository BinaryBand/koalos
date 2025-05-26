import 'module-alias/register';
import 'dotenv/config';

import { BigMapAbstraction, compose, TezosToolkit } from '@taquito/taquito';
import { Tzip12Module, tzip12 } from '@taquito/tzip12';
import { Tzip16Module, tzip16 } from '@taquito/tzip16';
import { InMemorySigner } from '@taquito/signer';
import { Schema, TokenSchema } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';
import { EntrypointsResponse } from '@taquito/rpc';

const RPC_URLS: string[] = [
  // 'https://mainnet.tezos.ecadinfra.com/',
  'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
  // 'https://rpc.tzkt.io/',
];

const RPC: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
const tezos: TezosToolkit = new TezosToolkit(RPC);
tezos.addExtension(new Tzip12Module());
tezos.addExtension(new Tzip16Module());

const FA12_TOKENS = {
  kusd: 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV',
  kdao: 'KT1WZ1HJyx5wPt96ZTjtWPotoPUk7pXNPfT2',
  wxtz: 'KT1VYsVfmobT7rsMVivvZ4J8i3bPiqz12NaH',
  tzbtc: 'KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn',
  stkr: 'KT1AEfeckNbdEYwaMKkytBwPJPycz7jdSGea',
  ethtz: 'KT19at7rQUvyjxnZ2fBv7D9zc8rkyG7gAoU8',
};

const FA20_TOKENS = {
  swc: 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g',
  usds: 'KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf',
  hdao: 'KT1AFA2mwNUMNd4SsujE1YYp29vd8BZejyKW',
};

tezos.setProvider({
  signer: new InMemorySigner(process.env['SECRET_KEY']!),
});

tezos.setProvider({
  signer: new InMemorySigner(process.env['SECRET_KEY']!),
});

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

async function main(): Promise<void> {
  // User wallet address
  const address: string = await tezos.signer.publicKeyHash();
  console.log('User address:', address);

  /*******************************
   * FA20 Contract Interaction
   *******************************/
  for (const [name, token] of Object.entries(FA20_TOKENS).concat(Object.entries(FA12_TOKENS))) {
    console.log(`${name}:`, token);
  }

  // const contract20 = await tezos.contract.at(contractAddress, compose(tzip12, tzip16));
  // assert(await contract20.tzip12().isTzip12Compliant(), 'Contract is not TZIP-12 compliant');
  // const tokenMetadata: TokenMetadata = await contract20.tzip12().getTokenMetadata(0);
  // console.log('Token Metadata:', tokenMetadata);
  // console.log(await contract20.contractViews.getBalance());

  // const balance_params = {
  //   request: [{ owner: 'mv19hrERfz4Drj6TXg79DF1ZXZDPwq5igZW7', token_id: '0' }],
  //   callback: 'KT1B9bXnsuqZkxbk2fBJbuhRRf1VpcFz2VV7',
  // };

  // const entrypoints: EntrypointsResponse = await tezos.rpc.getEntrypoints(contractAddress);
  // const storageSchema: Schema = new Schema(entrypoints.entrypoints['getBalance']);
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
