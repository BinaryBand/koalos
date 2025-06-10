// import 'dotenv/config';

export * from '@/tezos/metadata';
export * from '@/tezos/michelson';
export * from '@/tezos/provider';
export * from '@/tezos/transaction';
export * from '@/tezos/wallet';

// import { b58cdecode, prefix } from '@taquito/utils';
// import { OperationContents } from '@taquito/rpc';
// import { ed25519 } from '@noble/curves/ed25519';
// import BigNumber from 'bignumber.js';

// import { forgeOperation, sendForgedTransaction } from '@/tezos/transaction';
// import { createTransaction } from '@/tezos/wallet';

// /******************************
//  * DO NOT USE IN PRODUCTION!
//  ******************************/
// function sign(operationHash: string): string {
//   const bytes: Uint8Array = Buffer.from(operationHash, 'hex');

//   const secretKey: string = process.env['SECRET_KEY']!;
//   const sk: Uint8Array = b58cdecode(secretKey, prefix.edsk).subarray(0, 32);

//   const sig: Uint8Array = ed25519.sign(bytes, sk);
//   return Buffer.from(sig).toString('hex');
// }

// async function main() {
//   const address: string = process.env['ADDRESS']!;

//   const preparedParams: OperationContents[] = await createTransaction(address, [
//     { to: address, amount: new BigNumber(0.000001) },
//     { to: address, amount: new BigNumber(0.000001) },
//     { to: address, amount: new BigNumber(0.000001) },
//   ]);
//   console.log('Prepared transaction parameters:', preparedParams);

//   const [payloadHex, signHere] = await forgeOperation(preparedParams);
//   console.log('Forged operation bytes:', payloadHex.slice(0, 21), '...');
//   console.log('Sign this hash:', signHere);

//   const signatureHex: string = sign(signHere);
//   const op: string = await sendForgedTransaction(payloadHex, signatureHex);
//   console.log('Operation hash:', op);
// }

// main()
//   .then(async () => {
//     console.log('Done');
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error('Error:', error);
//     process.exit(1);
//   });
