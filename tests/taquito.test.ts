import { Estimate, ParamsWithKind, PreparedOperation, Signer, TezosToolkit } from '@taquito/taquito';
import { InMemorySigner } from '@taquito/signer';

import { createTransaction } from '@/index';
import { prepareBatch } from '@/tezos/taquito-mirror/prepare';
import { estimateBatch } from '@/tezos/taquito-mirror/estimate';
import { secretKey, publicKey, address } from '@public/constants/stub-values.json';
import RPC_URLS from '@public/constants/rpc-providers.json';

const BURN_ADDRESS: string = 'tz1burnburnburnburnburnburnburjAYjjX';
const DEFAULT_SIGNER: InMemorySigner = new InMemorySigner(secretKey);

const FORGERER: Signer = {
  secretKey: undefined!,
  publicKey: jest.fn().mockReturnValue(publicKey),
  publicKeyHash: jest.fn().mockReturnValue(BURN_ADDRESS),
  sign: undefined!,
};

const toolkit: TezosToolkit = new TezosToolkit(RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)]!);

describe('preparation tests', () => {
  it('prepare basic transaction batch', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);
    const batch: ParamsWithKind[] = [createTransaction(address, BURN_ADDRESS, 0.001)];
    const test: PreparedOperation = await prepareBatch(batch);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test).toEqual(control);
  });

  it('prepare batch transaction', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: ParamsWithKind[] = [
      createTransaction(address, BURN_ADDRESS, 0.0001),
      createTransaction(address, BURN_ADDRESS, 0.001),
    ];

    const test: PreparedOperation = await prepareBatch(batch);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test).toEqual(control);
  });

  it('prepare transaction with reveal requirement', async () => {
    toolkit.setSignerProvider(FORGERER);
    const batch: ParamsWithKind[] = [createTransaction(BURN_ADDRESS, address, 0.001)];
    const test: PreparedOperation = await prepareBatch(batch, publicKey);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test).toEqual(control);
  });
});

describe('batch estimate tests', () => {
  it('estimate basic transaction costs', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: ParamsWithKind[] = [
      createTransaction(address, BURN_ADDRESS, 0.0001),
      createTransaction(address, BURN_ADDRESS, 0.001),
    ];

    const preparedOperation: PreparedOperation = await prepareBatch(batch);
    const test: Estimate[] = await estimateBatch(preparedOperation);
    const control: Estimate[] = await toolkit.estimate.batch(batch);
    expect(test).toEqual(control);
  });

  it('estimate batch transaction with reveal requirement', async () => {
    toolkit.setSignerProvider(FORGERER);

    const batch: ParamsWithKind[] = [
      createTransaction(BURN_ADDRESS, address, 0.0001),
      createTransaction(BURN_ADDRESS, address, 0.001),
    ];

    const preparedOperation: PreparedOperation = await prepareBatch(batch, publicKey);
    const test: Estimate[] = await estimateBatch(preparedOperation);
    const control: Estimate[] = await toolkit.estimate.batch(batch);
    expect(test).toEqual(control);
  });
});
