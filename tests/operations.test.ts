import { b58cdecode, b58cencode, prefix, verifySignature } from '@taquito/utils';
import { OpKind, ParamsWithKind, PreparedOperation } from '@taquito/taquito';
import { OperationContents } from '@taquito/rpc';
import { InMemorySigner } from '@taquito/signer';
import { ed25519 } from '@noble/curves/ed25519';

import { createTransaction, prepare, forgeOperation } from '@/index';
import { secretKey, publicKey, address } from '@public/constants/stub-values.json';

const BURN_ADDRESS: string = 'tz1burnburnburnburnburnburnburjAYjjX';
const BRANCH_STUB: string = 'BL1kUezGw5rvjTruYPgpUGAazKsgkqr1gcm4NvjmxPu9VxTfpnF';
const PROTOCOL_STUB: string = 'PtLimaPtLimaPtLimaPtLimaPtLimaPtLimaPtLimaPtLimaPtLima';
const DEFAULT_SIGNER: InMemorySigner = new InMemorySigner(secretKey);
const WATERMARK: Uint8Array = new Uint8Array([0x03]);

function sign(operationHash: string): string {
  const bytes: Uint8Array = Buffer.from(operationHash, 'hex');
  const sk: Uint8Array = b58cdecode(secretKey, prefix.edsk).subarray(0, 32);
  const sig: Uint8Array = ed25519.sign(bytes, sk);
  return Buffer.from(sig).toString('hex');
}

describe('preapply operations tests', () => {
  it('verify forge operations', async () => {
    const verifyForged = (payload: string, signHere: string) => {
      expect(payload).toBeDefined();
      expect(signHere).toBeDefined();
      expect(/^[a-f0-9]+$/.test(payload)).toBeTruthy();
      expect(/^[a-f0-9]+$/.test(signHere)).toBeTruthy();
      expect(payload.length).toBeGreaterThan(0);
      expect(signHere.length).toBe(64);
    };

    const batch: ParamsWithKind[] = [createTransaction(address, BURN_ADDRESS, 0.0001)];
    const operation: PreparedOperation = await prepare(batch);
    let [payload, signHere] = await forgeOperation(operation);
    verifyForged(payload, signHere);

    batch.push(createTransaction(address, BURN_ADDRESS, 0.0002));
    const operationBatch: PreparedOperation = await prepare(batch);
    [payload, signHere] = await forgeOperation(operationBatch);
    verifyForged(payload, signHere);
  });

  it('test forge function', async () => {
    const operation: PreparedOperation = {
      opOb: { branch: BRANCH_STUB, contents: [], protocol: PROTOCOL_STUB },
      counter: 8190584,
    };

    const transaction: OperationContents = {
      kind: OpKind.TRANSACTION,
      fee: '0',
      gas_limit: '0',
      storage_limit: '0',
      amount: '1',
      destination: 'tz1burnburnburnburnburnburnburjAYjjX',
      source: 'tz1KqTpEZ7Yob7QbPE4Hy4Wo8fHG8LhKxZSx',
      counter: '8190585',
    };
    operation.opOb.contents.push(transaction);

    const [payload, signHere] = await forgeOperation(operation);
    expect(payload).toBe(
      '27a9c46a954c4cdeb5f4a5750bfd9763689a678285a35a7047a09eebc2ac5fa46c0002298c03ed7d454a101eb7022bc95f7e5f41ac7800f9f4f3030000010000b28066369a8ed09ba9d3d47f19598440266013f000'
    );
    expect(signHere).toBe('1da7a433d3f5600792f0033695460c3713eae4ba61857329f87f027a0c6aae6f');
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
