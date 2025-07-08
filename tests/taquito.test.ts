import { Estimate, ParamsWithKind, PreparedOperation, Signer, TezosToolkit } from '@taquito/taquito';

import { createTransaction } from '@/index';
import { prepareBatch } from '@/tezos/taquito-mirror/prepare';
import { estimateBatch } from '@/tezos/taquito-mirror/estimate';

import { burnPublicKey, burnAddress, revealedAddress } from '@public/tests/wallet.json';
import RPC_URLS from '@public/constants/rpc-providers.json';

const DEFAULT_SIGNER: Signer = {
  secretKey: undefined!,
  publicKey: jest.fn().mockReturnValue(''),
  publicKeyHash: jest.fn().mockReturnValue(revealedAddress),
  sign: undefined!,
};

const BURN_ADDRESS_SIGNER: Signer = {
  ...DEFAULT_SIGNER,
  publicKey: jest.fn().mockReturnValue(burnPublicKey),
  publicKeyHash: jest.fn().mockReturnValue(burnAddress),
};

const toolkit: TezosToolkit = new TezosToolkit(RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)]!);

describe('preparation tests', () => {
  it('prepare basic transaction batch', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);
    const batch: ParamsWithKind[] = [createTransaction(revealedAddress, burnAddress, 0.001)];
    const test: PreparedOperation = await prepareBatch(batch);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test).toEqual(control);
  });

  it('prepare batch transaction', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: ParamsWithKind[] = [
      createTransaction(revealedAddress, burnAddress, 0.0001),
      createTransaction(revealedAddress, burnAddress, 0.001),
    ];

    const test: PreparedOperation = await prepareBatch(batch);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test).toEqual(control);
  });

  it('prepare transaction with reveal requirement', async () => {
    toolkit.setSignerProvider(BURN_ADDRESS_SIGNER);
    const batch: ParamsWithKind[] = [createTransaction(burnAddress, revealedAddress, 0.001)];
    const test: PreparedOperation = await prepareBatch(batch, burnPublicKey);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test).toEqual(control);
  });
});

describe('batch estimate tests', () => {
  it('estimate basic transaction costs', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: ParamsWithKind[] = [
      createTransaction(revealedAddress, burnAddress, 0.0001),
      createTransaction(revealedAddress, burnAddress, 0.001),
    ];

    const preparedOperation: PreparedOperation = await prepareBatch(batch);
    const test: Estimate[] = await estimateBatch(preparedOperation);
    const control: Estimate[] = await toolkit.estimate.batch(batch);
    expect(test).toEqual(control);
  });

  // it('estimate batch transaction with reveal requirement', async () => {
  //   toolkit.setSignerProvider(BURN_ADDRESS_SIGNER);

  //   const batch: ParamsWithKind[] = [
  //     createTransaction(burnAddress, revealedAddress, 0.0001),
  //     createTransaction(burnAddress, revealedAddress, 0.001),
  //   ];

  //   const preparedOperation: PreparedOperation = await prepareBatch(batch, burnPublicKey);
  //   const test: Estimate[] = await estimateBatch(preparedOperation);
  //   const control: Estimate[] = await toolkit.estimate.batch(batch);
  //   expect(test).toEqual(control);
  // });
});
