// import { OperationContents, OperationHash } from '@taquito/rpc';
// import { b58cdecode, prefix } from '@taquito/utils';
// import { ed25519 } from '@noble/curves/ed25519';
// import { BigNumber } from 'bignumber.js';

// import { forgeOperation, sendForgedTransaction } from '@/tezos/transaction';
// import { createTransaction } from '@/tezos/wallet';

// function sign(operationHash: string): string {
//   const bytes: Uint8Array = Buffer.from(operationHash, 'hex');

//   const secretKey: string = process.env['SECRET_KEY']!;
//   const sk: Uint8Array = b58cdecode(secretKey, prefix.edsk).subarray(0, 32);

//   const sig: Uint8Array = ed25519.sign(bytes, sk);
//   return Buffer.from(sig).toString('hex');
// }

import { OperationContents } from '@taquito/rpc';
import { BigNumber } from 'bignumber.js';

// import { forgeOperation } from '@/tezos/transaction';
import { createTransaction } from '@/tezos/wallet';

describe('transaction tests', () => {
  it('create basic transaction', async () => {
    const address: string = process.env['Address']!;
    const tx: OperationContents[] = await createTransaction(address, [{ to: address, amount: BigNumber(0.001) }]);
    expect(tx).toBeDefined();
    expect(tx.every((op) => op.kind === 'transaction')).toBe(true);

    console.log('Transaction contents:', tx);

    // const [payload, signHere] = await forgeOperation(tx);
    // expect(payload).toBeDefined();
    // expect(signHere).toBeDefined();

    // const signedBytes: string = sign(signHere);
    // expect(signedBytes).toBeDefined();

    // const operation: OperationHash = await sendForgedTransaction(payload, signedBytes);
    // expect(operation).toBeDefined();
    // expect(operation).toMatch(/^o[1-9A-HJ-NP-Za-km-z]+$/);
  });
});
