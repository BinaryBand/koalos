import { Estimate, ParamsWithKind, Signer, TezosToolkit } from '@taquito/taquito';
import { OperationContentsAndResult, PreapplyResponse } from '@taquito/rpc';

import { createReveal, createTransaction, prepare } from '@/index';
import { prepareBatch } from '@/tezos/taquito-mirror/prepare';
import { estimateBatch } from '@/tezos/taquito-mirror/estimate';
import { runSimulation } from 'jest.setup';
import { assert } from '@/tools/utils';

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
    const batch: Transaction[] = [createTransaction(revealedAddress, burnAddress, 0.001)];
    const test: PreparedOperation = await prepareBatch(batch);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test).toEqual(control);
  });

  it('prepare batch transaction', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: Transaction[] = [
      createTransaction(revealedAddress, burnAddress, 0.0001),
      createTransaction(revealedAddress, burnAddress, 0.001),
    ];

    const test: PreparedOperation = await prepareBatch(batch);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test).toEqual(control);
  });

  it('prepare transaction with reveal requirement', async () => {
    toolkit.setSignerProvider(BURN_ADDRESS_SIGNER);

    const batch: Operation[] = [
      createReveal(burnAddress, burnPublicKey),
      createTransaction(burnAddress, revealedAddress, 0.0001),
    ];

    const prepared: PreparedOperation = await prepare(batch);
    const simulation: PreapplyResponse = await runSimulation(prepared);
    expect(
      simulation.contents.every((c: OperationContentsAndResult) => {
        assert('metadata' in c, 'Expected metadata to be present in operation contents');
        assert('operation_result' in c.metadata, 'Expected operation_result to be present in metadata');
        return c.metadata.operation_result.status === 'applied';
      })
    ).toBeTruthy();
  });
});

describe('batch estimate tests', () => {
  it('estimate basic transaction costs', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: Operation[] = [
      createTransaction(revealedAddress, burnAddress, 0.0001),
      createTransaction(revealedAddress, burnAddress, 0.001),
    ];

    const preparedOperation: PreparedOperation = await prepareBatch(batch);
    const test: Estimate[] = await estimateBatch(preparedOperation);
    const control: Estimate[] = await toolkit.estimate.batch(batch as ParamsWithKind[]);
    expect(test).toEqual(control);
  });

  it('estimate batch with reveal requirement', async () => {
    toolkit.setSignerProvider(BURN_ADDRESS_SIGNER);

    const batch: Operation[] = [
      createReveal(burnAddress, burnPublicKey),
      createTransaction(burnAddress, revealedAddress, 0.0001),
      createTransaction(burnAddress, revealedAddress, 0.001),
    ];

    const prepared: PreparedOperation = await prepare(batch);
    const simulation: PreapplyResponse = await runSimulation(prepared);
    expect(
      simulation.contents.every((c: OperationContentsAndResult) => {
        assert('metadata' in c, 'Expected metadata to be present in operation contents');
        assert('operation_result' in c.metadata, 'Expected operation_result to be present in metadata');
        return c.metadata.operation_result.status === 'applied';
      })
    ).toBeTruthy();
  });

  it('estimate batch without required reveal', async () => {
    toolkit.setSignerProvider(BURN_ADDRESS_SIGNER);

    const batch: Operation[] = [
      createTransaction(burnAddress, revealedAddress, 0.0001),
      createTransaction(burnAddress, revealedAddress, 0.001),
    ];

    try {
      await prepare(batch);
    } catch (error: unknown) {
      assert(error instanceof Error, 'Expected an error to be thrown');
      expect(error.message).toContain('Reveal operation is needed but not provided in the batch');
    }
  });
});
