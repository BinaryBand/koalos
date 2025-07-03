import { ParamsWithKind, PreparedOperation } from '@taquito/taquito';
import { BigNumber } from 'bignumber.js';

import {
  createTokenTransaction,
  getMetadata,
  getTokenBalance,
  getFa2TokenBalances,
  getTokenMetadata,
  prepare,
} from '@/index';
import { address } from '@public/constants/stub-values.json';

const BURN_ADDRESS: string = 'tz1burnburnburnburnburnburnburjAYjjX';

describe('token_balances', () => {
  it('fetch FA1.2 token balance', async () => {
    const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
    const balance: BigNumber = await getTokenBalance(kusd, BURN_ADDRESS);
    expect(balance.toNumber()).toBe(3000); // kUSD
  });

  it('fetch FA2 token balance', async () => {
    const crunchDao: string = 'KT1XPFjZqCULSnqfKaaYy8hJjeY63UNSGwXg';
    const balance: BigNumber = await getTokenBalance(crunchDao, BURN_ADDRESS, 0);
    expect(balance.toNumber()).toBe(1000); // CRUNCH DAO
  });

  it('fetch FA2 multi-token balances', async () => {
    const wrap: string = 'KT18fp5rcTW7mbWDmzFwjLDUhs5MeJmagDSZ';

    const tokenIds: number[] = [5, 10, 17, 19, 20];
    const balances: Fa2Balance[] = await getFa2TokenBalances(
      wrap,
      tokenIds.map((tokenId) => ({ owner: BURN_ADDRESS, tokenId: tokenId }))
    );

    expect(balances.length).toBe(tokenIds.length);
    expect(balances.every((b) => b.request.owner === BURN_ADDRESS)).toBeTruthy();
    expect(balances[0]?.balance.toNumber()).toBe(7000); // DAI
    expect(balances[1]?.balance.toNumber()).toBe(2000); // LINK
    expect(balances[2]?.balance.toNumber()).toBe(8000); // USDC
    expect(balances[3]?.balance.toNumber()).toBe(6000); // BTC
    expect(balances[4]?.balance.toNumber()).toBe(5000); // ETH
  });
});

describe('FA token operations', () => {
  it('create FA1.2 transaction', async () => {
    const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
    const batch: ParamsWithKind[] = [await createTokenTransaction(kusd, address, BURN_ADDRESS, BigNumber('1000000'))];
    expect(batch.every((tx) => tx.kind === 'transaction')).toBeTruthy();

    const operation: PreparedOperation = await prepare(batch);
    expect(operation.opOb.contents.length).toBe(1);
    expect(operation.opOb.contents.every((content) => content.kind === 'transaction')).toBeTruthy();
  });

  it('create FA2 transaction', async () => {
    const crunch: string = 'KT1BHCumksALJQJ8q8to2EPigPW6qpyTr7Ng';
    const batch: ParamsWithKind[] = [await createTokenTransaction(crunch, address, BURN_ADDRESS, BigNumber('1000000'))];
    expect(batch.every((tx) => tx.kind === 'transaction')).toBeTruthy();

    const operation: PreparedOperation = await prepare(batch);
    expect(operation.opOb.contents.length).toBe(1);
    expect(operation.opOb.contents.every((content) => content.kind === 'transaction')).toBeTruthy();
  });
});

describe('token metadata', () => {
  it('fetch FA1.2 token metadata from token_metadata[0][1]', async () => {
    const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
    const kusdTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(kusd);
    expect(kusdTokenMetadata!.name).toBe('Kolibri USD');
    expect(kusdTokenMetadata!.symbol).toBe('kUSD');
    expect(kusdTokenMetadata!.decimals).toBe('18');
  });

  it('fetch FA1.2 token metadata from token_metadata[0]["token_info"]', async () => {
    const kdao: string = 'KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH';
    const kdaoTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(kdao);
    expect(kdaoTokenMetadata!.name).toBe('Kolibri DAO');
    expect(kdaoTokenMetadata!.symbol).toBe('kDAO');
    expect(kdaoTokenMetadata!.decimals).toBe('18');
  });

  it('fetch FA2 token metadata from assets.token_metadata[0][token_id]["token_info"]', async () => {
    const crunch: string = 'KT1BHCumksALJQJ8q8to2EPigPW6qpyTr7Ng';
    const crunchTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(crunch, 0);
    expect(crunchTokenMetadata!.name).toBeUndefined();
    expect(crunchTokenMetadata!.symbol).toBe('CRUNCH');
    expect(crunchTokenMetadata!.decimals).toBe('8');
    expect(crunchTokenMetadata!.shouldPreferSymbol).toBe('true');
  });

  it('multi-token FA2 contract', async () => {
    const abr: string = 'KT1UG6PdaKoJcc3yD6mkFVfxnS1uJeW3cGeX';
    const abrTokenMetadata: TZip21TokenMetadata | undefined = await getTokenMetadata(abr, 1);
    expect(abrTokenMetadata!.name).toBe('Allbridge Wrapped BUSD');
    expect(abrTokenMetadata!.symbol).toBe('abBUSD');
    expect(abrTokenMetadata!.decimals).toBe('6');
  });
});

describe('contract metadata', () => {
  it('directly from from BigMap members', async () => {
    const swc: string = 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g';
    const swcTokenMetadata: TZip17Metadata | undefined = await getMetadata(swc);
    expect(swcTokenMetadata!.name).toBe('SwindleCoin');
    expect(swcTokenMetadata!.version).toBe('v1.0');
  });

  it('from internal contract storage, tezos-storage:data', async () => {
    const kusd: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV';
    const kusdTokenMetadata: TZip17Metadata | undefined = await getMetadata(kusd);
    expect(kusdTokenMetadata!.name).toBe('Kolibri Token Contract');
    expect(kusdTokenMetadata!.description).toBe('FA1.2 Implementation of kUSD');
    expect(kusdTokenMetadata!.homepage).toBe('https://kolibri.finance');
  });

  // This asset appears to be a scam, but it's the only one I could find with this metadata format.
  it('from external contract storage, tezos-storage://KT1GetVcigbLbWExeb6BqxHtZCbPGndJX2Xg/metadataJSON', async () => {
    const usds: string = 'KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf';
    const usdsTokenMetadata: TZip17Metadata | undefined = await getMetadata(usds);
    expect(usdsTokenMetadata!.homepage).toBe('https://stably.io/');
    expect(usdsTokenMetadata!.name).toBe('Stably USD');
    expect(usdsTokenMetadata!.version).toBe('1.7.0');
    expect(usdsTokenMetadata!.license?.['name']).toBe('MIT');
  });

  it('fetch metadata from assets.metadata and IPFS', async () => {
    const plenty: string = 'KT1GRSvLoikDsXujKgZPsGLX8k8VvR2Tq95b';
    const plentyTokenMetadata: TZip17Metadata | undefined = await getMetadata(plenty);
    expect(plentyTokenMetadata!.name).toBe('PLENTY');
    expect(plentyTokenMetadata!.description).toBe('Plenty DeFi DAO');
    expect(plentyTokenMetadata!.homepage).toBe('https://plentydefi.com');
    expect(plentyTokenMetadata!.interfaces[0]).toBe('TZIP-007-2021-04-17');
    expect(plentyTokenMetadata!.interfaces[1]).toBe('TZIP-016-2021-04-17');
  });
});
