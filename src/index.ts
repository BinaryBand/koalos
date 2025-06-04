'use strict';

import { Estimate, PreparedOperation } from '@taquito/taquito';
import BigNumber from 'bignumber.js';

import { ForgeParams, LocalForger } from '@taquito/local-forging';

import {
  getTokenBalance,
  getTokenSupply,
  estimateTokenTransfers,
  sendTokens,
} from './tools/smart-contracts/tokens/tokens.js';
import { BatchWalletOperation } from '@taquito/taquito/dist/types/wallet/batch-operation.js';
import { getMetadata, getTokenMetadata } from './tools/smart-contracts/tokens/metadata.js';
import { getOmniWallet, getMetaWallet, sendTezos } from './tools/wallet.js';
import { initHelia, stopHelia } from './network/helia.js';
import { initDatabase } from './network/cache.js';
import Tezos from './network/taquito.js';

const FA: Record<string, [string, number]> = {
  kusd: ['KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV', 0],
  kdao: ['KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH', 0],
  wxtz: ['KT1VYsVfmobT7rsMVivvZ4J8i3bPiqz12NaH', 0], // Missing metadata
  tzbtc: ['KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn', 0], // Metadata function
  stkr: ['KT1AEfeckNbdEYwaMKkytBwPJPycz7jdSGea', 0], // Missing metadata
  ethtz: ['KT19at7rQUvyjxnZ2fBv7D9zc8rkyG7gAoU8', 0], // Missing metadata
  swc: ['KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g', 0],
  usds: ['KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf', 0],
  hdao: ['KT1AFA2mwNUMNd4SsujE1YYp29vd8BZejyKW', 0],
  crunch: ['KT1BHCumksALJQJ8q8to2EPigPW6qpyTr7Ng', 0],
  quipu: ['KT193D4vozYnhGJQVtw7CoxxqphqUEEwK6Vb', 0],
  nft: ['KT19WKbn393rm31rt6igCG2TByikYRKKkfmd', 0],
  wrap: ['KT1LRboPna9yQY9BrjtQYDS1DVxhKESK4VVd', 0],
  plenty: ['KT1GRSvLoikDsXujKgZPsGLX8k8VvR2Tq95b', 0],
};

async function main(): Promise<void> {
  // await initDatabase();
  // await initHelia();

  // console.log('Tezos:', (await getOmniWallet()).price.toPrecision(2), '$');

  const address: string = 'tz1TEGKFN9pUpLPvLZXgGjuVoWaebfJS9tuh';
  // const wallet: MetaWallet = await getMetaWallet(address);
  // console.log('User address:', address);
  // console.log('Balance:', wallet.balance, 'ꜩ');
  // console.log('Domain:', wallet.domain);

  // const estimates: Estimate[] = await estimateTransfers(address, [
  //   { to: address, amount: new BigNumber(0.000001) },
  //   { to: address, amount: new BigNumber(0.000001) },
  //   { to: address, amount: new BigNumber(0.000001) },
  // ]);
  // console.log('Estimates for transfers:', estimates);

  const operation: ForgeParams = await sendTezos(address, [
    { to: address, amount: new BigNumber(0.000001) },
    { to: address, amount: new BigNumber(0.000001) },
    { to: address, amount: new BigNumber(0.000001) },
  ]);
  console.log(operation);

  // const forger: LocalForger = new LocalForger();
  // const forgedBytes: string = await forger.forge(operation);
  // console.log('Operation prepared:', forgedBytes);

  // // Contracts
  // const fa12: FA12 = await Tezos().contract.at<FA12>(FA.swc[0]);

  // const fa12Metadata: TZip17Metadata | undefined = await getMetadata(fa12);
  // console.log('FA1.2 metadata:', fa12Metadata);

  // const fa12TokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(fa12);
  // console.log('FA1.2 token metadata:', fa12TokenMetadata);

  // const [fa12Name, fa12Decimals, fa12Symbol]: [string, number, string?] = [
  //   fa12TokenMetadata?.name || fa12Metadata?.name || '',
  //   fa12TokenMetadata?.decimals ? parseInt(fa12TokenMetadata.decimals, 10) : 0,
  //   fa12TokenMetadata?.symbol,
  // ];

  // const factor: number = Math.pow(10, fa12Decimals);
  // console.log(`${fa12Name} balance:`, (await getTokenBalance(fa12, address)).toNumber() / factor, fa12Symbol);
  // console.log(`${fa12Name} supply:`, (await getTokenSupply(fa12)).toNumber() / factor, fa12Symbol);

  // const fa12Estimations: Estimate[] = await estimateTokenTransfers(fa12, address, [
  //   { to: address, amount: new BigNumber(1) },
  //   { to: address, amount: new BigNumber(1) },
  //   { to: address, amount: new BigNumber(1) },
  // ]);
  // console.log('FA12 estimations:', fa12Estimations);

  // const fa12Operation: BatchWalletOperation = await sendTokens(fa12, address, [
  //   { to: address, amount: new BigNumber(1) },
  //   { to: address, amount: new BigNumber(1) },
  //   { to: address, amount: new BigNumber(1) },
  // ]);

  // // FA2 contract
  // const fa2: FA2 = await Tezos().contract.at<FA2>(FA.plenty[0]);

  // const fa2Metadata: TZip17Metadata | undefined = await getMetadata(fa2);
  // console.log('FA2 metadata:', fa2Metadata);

  // const fa2TokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(fa2);
  // console.log('FA2 token metadata:', fa2TokenMetadata);

  // const [fa2Name, fa2Decimals, fa2Symbol]: [string, number, string?] = [
  //   fa2TokenMetadata?.name || fa2Metadata?.name || '',
  //   fa2TokenMetadata?.decimals ? parseInt(fa2TokenMetadata.decimals, 10) : 0,
  //   fa2TokenMetadata?.symbol,
  // ];

  // const factor2: number = Math.pow(10, fa2Decimals);
  // console.log(`${fa2Name} balance:`, (await getTokenBalance(fa2, address)).toNumber() / factor2, fa2Symbol);

  // const fa2Estimations = await estimateTokenTransfers(fa2, address, [
  //   { to: address, amount: new BigNumber(1) },
  //   { to: address, amount: new BigNumber(1) },
  //   { to: address, amount: new BigNumber(1) },
  // ]);
  // console.log('FA2 estimations:', fa2Estimations);

  // const fa2Operation: BatchWalletOperation = await sendTokens(fa2, address, [
  //   { to: address, amount: new BigNumber(1) },
  //   { to: address, amount: new BigNumber(1) },
  //   { to: address, amount: new BigNumber(1) },
  // ]);
}

main()
  .then(async () => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
// .finally(stopHelia);
