import { hasMetadataWithResult } from '@taquito/taquito';
import { PreapplyResponse } from '@taquito/rpc';
import { BigNumber } from 'bignumber.js';

import { createTransaction, prepare, Fa12Token, Fa2Token, simulateOperation } from '@/index';
import { Fa2Balance, TZip17Metadata, TZip21TokenMetadata } from '@/tezos/types';
import { assert } from '@/tools/utils';

import { burnAddress, revealedAddress } from '@public/tests/wallet.json';

const fa12Contract: string = 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV'; // Kolibri USD
const fa2Contract_1: string = 'KT1XPFjZqCULSnqfKaaYy8hJjeY63UNSGwXg'; // CRUNCH DAO
const fa2Contract_2: string = 'KT18fp5rcTW7mbWDmzFwjLDUhs5MeJmagDSZ'; // Wrap Protocol
const faContract_1: string = 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g'; // SwindleCoin
const faContract_2: string = 'KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf'; // Stably USD

describe('FA-1.2 token contract', () => {
  const fa12Instance: Fa12Token = new Fa12Token(fa12Contract);

  it('fetch total token supply', async () => {
    const supply: BigNumber = await fa12Instance.getTotalSupply();
    expect(supply.toNumber()).toBe(1699968);
  });

  it('fetch token balance', async () => {
    const balance: BigNumber = await fa12Instance.getBalance(burnAddress);
    expect(balance.toNumber()).toBe(15776);
  });

  it('create token transfer params', async () => {
    const transferParams: TransactionOperationParameter = await fa12Instance.transfer(
      revealedAddress,
      burnAddress,
      1000
    );
    expect(transferParams).toEqual({
      entrypoint: 'transfer',
      value: {
        prim: 'Pair',
        args: [{ string: revealedAddress }, { prim: 'Pair', args: [{ string: burnAddress }, { int: '1000' }] }],
      },
    });

    // Check if this operation is valid
    const batch = [createTransaction(revealedAddress, fa12Instance.address, 0, transferParams)];
    const prepared: PreparedOperation = await prepare(batch);
    const simulation: PreapplyResponse = await simulateOperation(prepared);
    simulation.contents.forEach((c) => {
      assert(hasMetadataWithResult(c), 'Expected metadata with operation result to be present');
      expect(c.metadata.operation_result).toMatchObject({ status: 'applied' });
    });
  });

  it('get contract metadata from Tezos local URI, tezos-storage:data', async () => {
    const metadata: TZip17Metadata | undefined = await fa12Instance.getMetadata();
    expect(metadata).toEqual({
      name: 'Kolibri Token Contract',
      description: 'FA1.2 Implementation of kUSD',
      authors: ['Hover Labs <hello@hover.engineering>'],
      homepage: 'https://kolibri.finance',
      interfaces: ['TZIP-007-2021-01-29'],
    });
  });

  it('get token metadata', async () => {
    const tokenMetadata: TZip21TokenMetadata | undefined = await fa12Instance.getTokenMetadata();
    expect(tokenMetadata).toEqual({
      decimals: '18',
      name: 'Kolibri USD',
      symbol: 'kUSD',
      thumbnailUri: ' https://kolibri-data.s3.amazonaws.com/logo.png',
    });
  });
});

describe('FA-2 token contract', () => {
  const fa2Instance_1: Fa2Token = new Fa2Token(fa2Contract_1);
  const fa2Instance_2: Fa2Token = new Fa2Token(fa2Contract_2);

  it('fetch single token balance', async () => {
    const balance: Fa2Balance[] = await fa2Instance_1.balanceOf([{ owner: burnAddress, token_id: 0 }]);
    expect(balance[0]?.balance.toNumber()).toBe(13751);
  });

  it('fetch multiple token balances', async () => {
    const balances: Fa2Balance[] = await fa2Instance_2.balanceOf(
      [5, 10, 17, 19, 20].map((token_id: number) => ({ owner: burnAddress, token_id }))
    );

    expect(balances.every((b) => b.request.owner === burnAddress)).toBeTruthy();
    expect(balances[0]?.balance.toNumber()).toBe(13751); // DAI
    expect(balances[1]?.balance.toNumber()).toBe(11875); // LINK
    expect(balances[2]?.balance.toNumber()).toBe(16432); // USDC
    expect(balances[3]?.balance.toNumber()).toBe(10624); // BTC
    expect(balances[4]?.balance.toNumber()).toBe(19376); // ETH
  });

  it('create token multiple transfer params', async () => {
    const transferParams: TransactionOperationParameter = await fa2Instance_2.transfer([
      { from_: revealedAddress, txs: [{ to_: burnAddress, token_id: 5, amount: BigNumber(0) }] },
      { from_: revealedAddress, txs: [{ to_: burnAddress, token_id: 10, amount: BigNumber(0) }] },
    ]);

    expect(transferParams.value).toEqual([
      {
        prim: 'Pair',
        args: [
          { string: revealedAddress },
          [
            {
              prim: 'Pair',
              args: [{ string: burnAddress }, { prim: 'Pair', args: [{ int: '5' }, { int: '0' }] }],
            },
          ],
        ],
      },
      {
        prim: 'Pair',
        args: [
          { string: revealedAddress },
          [
            {
              prim: 'Pair',
              args: [{ string: burnAddress }, { prim: 'Pair', args: [{ int: '10' }, { int: '0' }] }],
            },
          ],
        ],
      },
    ]);

    const batch: Operation[] = [createTransaction(revealedAddress, fa2Instance_2.address, 0, transferParams)];

    const prepared: PreparedOperation = await prepare(batch);
    const simulation: PreapplyResponse = await simulateOperation(prepared);
    simulation.contents.forEach((c) => {
      assert(hasMetadataWithResult(c), 'Expected metadata with operation result to be present');
      expect(c.metadata.operation_result).toMatchObject({ status: 'applied' });
    });
  });

  it('get contract metadata', async () => {
    const crunchMetadata: TZip17Metadata | undefined = await fa2Instance_1.getMetadata();
    expect(crunchMetadata).toEqual({
      version: '1.0.0',
      name: 'Crunchy DAO',
      authors: ['Crunchy.Network'],
      interfaces: ['TZIP-012', 'TZIP-016', 'TZIP-021'],
    });

    const wrapMetadata: TZip17Metadata | undefined = await fa2Instance_2.getMetadata();
    expect(wrapMetadata).toEqual({
      name: 'Wrap protocol FA2 tokens',
      homepage: 'https://github.com/bender-labs/wrap-tz-contracts',
      interfaces: ['TZIP-012', 'TZIP-016', 'TZIP-021'],
    });
  });
});

describe('Non-standard FA token contract', () => {
  it('fetch contract metadata directly from BigMap members', async () => {
    const faInstance: Fa2Token = new Fa2Token(faContract_1);
    const metadata: TZip17Metadata | undefined = await faInstance.getMetadata();
    expect(metadata).toEqual({
      name: 'SwindleCoin',
      description: 'This token is worth nothing. Anyone who says otherwise is trying to swindle you.',
      version: 'v1.0',
    });
  });

  it('fetch contract metadata from Tezos URI, tezos-storage://KT1GetVcigbLbWExeb6BqxHtZCbPGndJX2Xg/metadataJSON', async () => {
    const faInstance: Fa2Token = new Fa2Token(faContract_2);
    const metadata: TZip17Metadata | undefined = await faInstance.getMetadata();
    expect(metadata?.homepage).toBe('https://stably.io/');
    expect(metadata?.name).toBe('Stably USD');
    expect(metadata?.version).toBe('1.7.0');
    expect(metadata?.interfaces).toEqual(['TZIP-012', 'TZIP-017']);
  });
});
