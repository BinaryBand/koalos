import { b58cdecode, b58cencode, prefix, verifySignature } from '@taquito/utils';
import { hasMetadataWithResult, OpKind } from '@taquito/taquito';
import { PreapplyResponse } from '@taquito/rpc';
import { InMemorySigner } from '@taquito/signer';
import { ed25519 } from '@noble/curves/ed25519';
import { assert } from '@/tools/utils';

import {
  checkRevealed,
  createReveal,
  createTransaction,
  createOrigination,
  forgeOperation,
  prepare,
  simulateOperation,
} from '@/index';

import { burnPublicKey, burnAddress, revealedAddress } from '@public/tests/wallet.json';
import { secretKey, publicKey, branch, protocol } from '@public/constants/stub-values.json';
import { code, storage } from '@public/tests/simple-contract.json';

const DEFAULT_SIGNER: InMemorySigner = new InMemorySigner(secretKey);
const WATERMARK: Uint8Array = new Uint8Array([0x03]);

function sign(operationHash: string): string {
  const bytes: Uint8Array = Buffer.from(operationHash, 'hex');
  const sk: Uint8Array = b58cdecode(secretKey, prefix.edsk).subarray(0, 32);
  const sig: Uint8Array = ed25519.sign(bytes, sk);
  return Buffer.from(sig).toString('hex');
}

describe('reveal tests', () => {
  it('check if address is revealed', async () => {
    const isRevealed: boolean = await checkRevealed(revealedAddress);
    expect(isRevealed).toBeTruthy();
  });

  it('check if address is not revealed', async () => {
    const isRevealed: boolean = await checkRevealed(burnAddress);
    expect(isRevealed).toBeFalsy();
  });
});

describe('operation tests', () => {
  it('verify simple operation', async () => {
    const batch: Operation[] = [createTransaction(revealedAddress, burnAddress, 0.0001)];

    const prepared: PreparedOperation = await prepare(batch);
    const simulation: PreapplyResponse = await simulateOperation(prepared);
    simulation.contents.forEach((c) => {
      assert(hasMetadataWithResult(c), 'Expected metadata with operation result to be present');
      expect(c.metadata.operation_result).toMatchObject({ status: 'applied' });
    });
  });

  it('verify batched operation', async () => {
    const batch: Operation[] = [
      createTransaction(revealedAddress, burnAddress, 0.0001),
      createTransaction(revealedAddress, burnAddress, 0.001),
    ];

    const prepared: PreparedOperation = await prepare(batch);
    const simulation: PreapplyResponse = await simulateOperation(prepared);
    simulation.contents.forEach((c) => {
      assert(hasMetadataWithResult(c), 'Expected metadata with operation result to be present');
      expect(c.metadata.operation_result).toMatchObject({ status: 'applied' });
    });
  });

  it('verify batch with reveal requirement', async () => {
    const batch: Operation[] = [
      createReveal(burnAddress, burnPublicKey),
      createTransaction(burnAddress, revealedAddress, 0.0001),
      createTransaction(burnAddress, revealedAddress, 0.001),
    ];

    const prepared: PreparedOperation = await prepare(batch);
    const simulation: PreapplyResponse = await simulateOperation(prepared);
    simulation.contents.forEach((c) => {
      assert(hasMetadataWithResult(c), 'Expected metadata with operation result to be present');
      expect(c.metadata.operation_result).toMatchObject({ status: 'applied' });
    });
  });

  it('verify batch without required reveal', async () => {
    const batch: Operation[] = [
      createTransaction(burnAddress, revealedAddress, 0.0001),
      createTransaction(burnAddress, revealedAddress, 0.001),
    ];

    try {
      await prepare(batch);
    } catch (error: unknown) {
      assert(error instanceof Error, 'Expected an error to be thrown');
      expect(typeof error.message).toBe('string');
    }
  });
});

describe('smart contracts', () => {
  it('prepare code origination params', async () => {
    const batch: Operation[] = [await createOrigination(revealedAddress, code, storage)];

    const prepared: PreparedOperation = await prepare(batch);
    const simulation: PreapplyResponse = await simulateOperation(prepared);
    simulation.contents.forEach((c) => {
      assert(hasMetadataWithResult(c), 'Expected metadata with operation result to be present');
      expect(c.metadata.operation_result).toMatchObject({ status: 'applied' });
    });
  });
});

describe('preapply operations tests', () => {
  it('test forge function', async () => {
    const operation: PreparedOperation = {
      opOb: {
        branch,
        protocol,
        contents: [
          {
            kind: OpKind.TRANSACTION,
            fee: '0',
            gas_limit: '0',
            storage_limit: '0',
            amount: '1',
            destination: burnAddress,
            source: revealedAddress,
            counter: '8190585',
          },
        ],
      },
      counter: 8190584,
    };

    const [payload, signHere] = await forgeOperation(operation);
    expect(payload).toBe(
      '27a9c46a954c4cdeb5f4a5750bfd9763689a678285a35a7047a09eebc2ac5fa46c00253421ab745fe0736f6ac43c018527ee2beb701700f9f4f3030000010000d3dfd34be90506a14f39794a455a6b1abf1d302f00'
    );
    expect(signHere).toBe('ee2f71f5b7aafe9191c028ebe2db680949a73742b11a7f856c951fa9ae4e31cf');
  });

  it('preapply basic transaction', async () => {
    const payload: string =
      '75af9596f6cc10bb75d2283e64e872cb30c6924fa8f582168ec22f617438f71e6c0002298c03ed7d454a101eb7022bc95f7e5f41ac789302f9f4f3030200640000b28066369a8ed09ba9d3d47f19598440266013f000';
    const signHere: string = '0c4b244bb9c3a8464658152d853088a66cfdc5e97f0fc138b5fe4d088a5d8558';

    const signedBytes: string = sign(signHere);
    const signature: string = b58cencode(signedBytes, prefix.edsig);
    expect(verifySignature(payload, publicKey, signature, WATERMARK)).toBeTruthy();

    const { prefixSig } = await DEFAULT_SIGNER.sign(payload, WATERMARK);
    expect(signature).toBe(prefixSig);
  });

  it('preapply operation batch', async () => {
    const payload: string =
      'f39be0b2a244e1e3adad1540fd403b7b448cc6cd2108015711de8df9b60339d26c0002298c03ed7d454a101eb7022bc95f7e5f41ac78e301f9f4f3030200640000b28066369a8ed09ba9d3d47f19598440266013f0006c0002298c03ed7d454a101eb7022bc95f7e5f41ac78e301faf4f3030200c8010000b28066369a8ed09ba9d3d47f19598440266013f000';
    const signHere: string = 'a61efd87ab91ac63cc5488a450f43a478ac64cc2bdfc2579f5149608f758bf0c';

    const signedBytes: string = sign(signHere);
    const signature: string = b58cencode(signedBytes, prefix.edsig);
    const { prefixSig } = await DEFAULT_SIGNER.sign(payload, WATERMARK);
    expect(signature).toBe(prefixSig);
  });
});
