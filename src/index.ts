import 'dotenv/config';

import { b58cdecode, prefix } from '@taquito/utils';
import { ForgeParams } from '@taquito/taquito';
import { ed25519 } from '@noble/curves/ed25519';
import BigNumber from 'bignumber.js';

import { getTokenBalance, getTokenSupply, createTokenTransaction } from './tools/smart-contracts/tokens/tokens.js';
import { getMetadata, getTokenMetadata } from './tools/smart-contracts/tokens/metadata.js';
import { forgeOperation, sendForgedTransaction } from './tools/chain/transactions.js';
import { createTransaction, getWalletData } from './tools/wallet.js';
import { getTezosData } from './tools/chain/oracle.js';
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

// /******************************
//  * DO NOT USE IN PRODUCTION!
//  ******************************/
function sign(operationHash: string): string {
  const bytes: Uint8Array = Buffer.from(operationHash, 'hex');

  const secretKey: string = process.env.SECRET_KEY!;
  const sk: Uint8Array = b58cdecode(secretKey, prefix.edsk).subarray(0, 32);

  const sig: Uint8Array = ed25519.sign(bytes, sk);
  return Buffer.from(sig).toString('hex');
}

async function main(): Promise<void> {
  await initDatabase();

  const { tezosPrice } = await getTezosData();
  console.log('Tezos price:', tezosPrice, '$');

  const address = 'tz1TEGKFN9pUpLPvLZXgGjuVoWaebfJS9tuh';
  const wallet: WalletData = await getWalletData(address);
  console.log('User address:', address);
  console.log('Balance:', wallet.balance, 'ꜩ');
  console.log('Domain:', wallet.domain);

  // Test native Tezos transactions
  const skipNativeTransaction: boolean = false;
  if (!skipNativeTransaction) {
    const preparedParams: ForgeParams = await createTransaction(address, [
      { to: address, amount: new BigNumber(0.000001) },
      { to: address, amount: new BigNumber(0.000001) },
      { to: address, amount: new BigNumber(0.000001) },
    ]);

    const [payload, signHere] = await forgeOperation(preparedParams);
    console.log('Operation payload:', payload.slice(0, 12), '...');
    console.log('Sign here:', signHere.slice(0, 12), '...');

    const signedBytes: string = sign(signHere);
    console.log('Signed bytes:', signedBytes.slice(0, 12), '...');

    const opHash: string = await sendForgedTransaction(payload, signedBytes);
    console.log('Operation hash:', opHash);
  }

  /***************************************
   * Test FA1.2 Tezos token
   ***************************************/
  const fa12: FA12 = await Tezos().contract.at<FA12>(FA.swc[0]);
  const fa12Metadata: TZip17Metadata | undefined = await getMetadata(fa12);
  const fa12TokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(fa12);

  const [fa12Name, fa12Decimals, fa12Symbol]: [string, number, string?] = [
    fa12TokenMetadata?.name || fa12Metadata?.name || '',
    fa12TokenMetadata?.decimals ? parseInt(fa12TokenMetadata.decimals, 10) : 0,
    fa12TokenMetadata?.symbol,
  ];

  const fa12Factor: number = Math.pow(10, fa12Decimals);
  console.log(`${fa12Name} balance:`, (await getTokenBalance(fa12, address)).toNumber() / fa12Factor, fa12Symbol);
  console.log(`${fa12Name} supply:`, (await getTokenSupply(fa12)).toNumber() / fa12Factor, fa12Symbol);

  // Test Tezos FA1.2 token transactions
  const skipFa12TokenTransaction: boolean = false;
  if (!skipFa12TokenTransaction) {
    const preparedParams: ForgeParams = await createTokenTransaction(fa12, address, [
      { to: address, amount: new BigNumber(1) },
      { to: address, amount: new BigNumber(1) },
      { to: address, amount: new BigNumber(1) },
    ]);

    const [payload, signHere] = await forgeOperation(preparedParams);
    console.log('Operation payload:', payload.slice(0, 12), '...');
    console.log('Sign here:', signHere.slice(0, 12), '...');

    const signedBytes: string = sign(signHere);
    console.log('Signed bytes:', signedBytes.slice(0, 12), '...');

    const opHash: string = await sendForgedTransaction(payload, signedBytes);
    console.log('Operation hash:', opHash);
  }

  /***************************************
   * Test FA2 Tezos token
   ***************************************/
  const fa2: FA2 = await Tezos().contract.at<FA2>(FA.plenty[0]);
  const fa2Metadata: TZip17Metadata | undefined = await getMetadata(fa2);
  const fa2TokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(fa2);

  const [fa2Name, fa2Decimals, fa2Symbol]: [string, number, string?] = [
    fa2TokenMetadata?.name || fa2Metadata?.name || '',
    fa2TokenMetadata?.decimals ? parseInt(fa2TokenMetadata.decimals, 10) : 0,
    fa2TokenMetadata?.symbol,
  ];

  const fa2Factor: number = Math.pow(10, fa2Decimals);
  console.log(`${fa2Name} balance:`, (await getTokenBalance(fa2, address)).toNumber() / fa2Factor, fa2Symbol);

  // Test Tezos FA2 token transactions
  const skipFa2TokenTransaction: boolean = false;
  if (!skipFa2TokenTransaction) {
    const preparedParams: ForgeParams = await createTokenTransaction(fa12, address, [
      { to: address, amount: new BigNumber(1), tokenId: FA.plenty[1] },
      { to: address, amount: new BigNumber(1), tokenId: FA.plenty[1] },
      { to: address, amount: new BigNumber(1), tokenId: FA.plenty[1] },
    ]);

    const [payload, signHere] = await forgeOperation(preparedParams);
    console.log('Operation payload:', payload.slice(0, 12), '...');
    console.log('Sign here:', signHere.slice(0, 12), '...');

    const signedBytes: string = sign(signHere);
    console.log('Signed bytes:', signedBytes.slice(0, 12), '...');

    const opHash: string = await sendForgedTransaction(payload, signedBytes);
    console.log('Operation hash:', opHash);
  }
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
