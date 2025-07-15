import { Estimate, hasMetadataWithResult, ParamsWithKind, Signer, TezosToolkit } from '@taquito/taquito';
import { PreapplyResponse } from '@taquito/rpc';

import { createReveal, createTransaction, simulateOperation } from '@/index';
import { estimateBatch } from '@/tezos/taquito-mirror/estimate';
import { prepareBatch } from '@/tezos/taquito-mirror/prepare';
import { BlockchainInstance } from '@/tezos/blockchain';
import RpcProvider from '@/tezos/provider';
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

const blockchainInstance: BlockchainInstance = BlockchainInstance.createInstance();
const toolkit: TezosToolkit = new TezosToolkit(RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)]!);

describe('preparation tests', () => {
  it('prepare basic transaction', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: Transaction[] = [createTransaction(revealedAddress, burnAddress, 0.001)];

    const test: PreparedOperation = await prepareBatch(revealedAddress, batch);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test.opOb.contents).toEqual(control.opOb.contents);
  });

  it('prepare batched transactions', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: Transaction[] = [
      createTransaction(revealedAddress, burnAddress, 0.0001),
      createTransaction(revealedAddress, burnAddress, 0.001),
    ];

    const test: PreparedOperation = await prepareBatch(revealedAddress, batch);
    const control: PreparedOperation = await toolkit.prepare.batch(batch);
    expect(test.opOb.contents).toEqual(control.opOb.contents);
  });

  it('prepare transaction batch with reveal requirement', async () => {
    toolkit.setSignerProvider(BURN_ADDRESS_SIGNER);

    const batch: Operation[] = [
      createReveal(burnAddress, burnPublicKey),
      createTransaction(burnAddress, revealedAddress, 0.001),
      createTransaction(burnAddress, revealedAddress, 0.00025),
      createTransaction(burnAddress, revealedAddress, 0.0005),
      createTransaction(burnAddress, revealedAddress, 0.00075),
    ];

    const prepared: PreparedOperation = await blockchainInstance.prepare(batch);
    const simulation: PreapplyResponse = await simulateOperation(prepared);
    simulation.contents.forEach((c) => {
      assert(hasMetadataWithResult(c), 'Expected metadata with operation result to be present');
      expect(c.metadata.operation_result).toMatchObject({ status: 'applied' });
    });
  });
});

describe('batch estimate tests', () => {
  it('estimate basic transaction costs', async () => {
    toolkit.setSignerProvider(DEFAULT_SIGNER);

    const batch: Operation[] = [
      createTransaction(revealedAddress, burnAddress, 0.001),
      createTransaction(revealedAddress, burnAddress, 0.00025),
      createTransaction(revealedAddress, burnAddress, 0.0005),
      createTransaction(revealedAddress, burnAddress, 0.00075),
    ];

    const constants: ConstantsResponse = await RpcProvider.singleton.getConstants();
    const preparedOperation: PreparedOperation = await prepareBatch(revealedAddress, batch, { constants });
    const test: Estimate[] = await estimateBatch(preparedOperation, { constants });
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

    const prepared: PreparedOperation = await blockchainInstance.prepare(batch);
    const simulation: PreapplyResponse = await simulateOperation(prepared);
    simulation.contents.forEach((c) => {
      assert(hasMetadataWithResult(c), 'Expected metadata with operation result to be present');
      expect(c.metadata.operation_result).toMatchObject({ status: 'applied' });
    });
  });

  it('estimate batch without required reveal', async () => {
    toolkit.setSignerProvider(BURN_ADDRESS_SIGNER);

    const batch: Operation[] = [
      createTransaction(burnAddress, revealedAddress, 0.0001),
      createTransaction(burnAddress, revealedAddress, 0.001),
    ];

    try {
      await blockchainInstance.prepare(batch);
    } catch (error: unknown) {
      assert(error instanceof Error, 'Expected an error to be thrown');
      expect(typeof error.message).toBe('string');
    }
  });
});
