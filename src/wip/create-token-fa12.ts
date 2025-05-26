// import 'module-alias/register';
// import 'dotenv/config';

// import { TezosToolkit, MichelsonMap } from '@taquito/taquito';
// import { InMemorySigner } from '@taquito/signer';

// import { Buffer } from 'buffer';

// import TokenCode from './contracts/token12.json';

// const tezos: TezosToolkit = new TezosToolkit('https://ghostnet.tezos.ecadinfra.com');

// tezos.setProvider({
//   signer: new InMemorySigner(
//     'edskS17P99MwjHo9G3Rn6zWLi6vDVjZ2Rt7B9nY6iao2m8Mpa1Rh7epiueFZJpa1kgFrfLzV5pSDt7vhURWFhSUkzKsahU3JKf'
//   ),
// });

// async function main() {
//   const address: string = await tezos.wallet.pkh();
//   console.log(`Address: ${address}`);

//   const balance = await tezos.tz.getBalance(address);
//   console.log(`Balance: ${balance.toString()} mutez`);

//   const metadata = {
//     name: Buffer.from('SwindleCoin').toString('hex'),
//     description: Buffer.from(
//       'This token is worth nothing. Anyone who says otherwise is trying to swindle you.'
//     ).toString('hex'),
//     version: Buffer.from('v1.0').toString('hex'),
//   };

//   const tokenMetadata = {
//     token_id: 0,
//     token_info: MichelsonMap.fromLiteral({
//       decimals: Buffer.from('8').toString('hex'),
//       icon: Buffer.from('ipfs://QmRedMhNPW4bHTzPwLFCgAnxTWeZd5DsFmYPrsT5XdfRwu').toString('hex'),
//       name: Buffer.from('SwindleCoin').toString('hex'),
//       symbol: Buffer.from('SWC').toString('hex'),
//       thumbnailUri: Buffer.from('ipfs://QmRedMhNPW4bHTzPwLFCgAnxTWeZd5DsFmYPrsT5XdfRwu').toString('hex'),
//     }),
//   };

//   const operation = await tezos.contract.originate({
//     code: TokenCode,
//     storage: {
//       administrator: address,
//       metadata: MichelsonMap.fromLiteral(metadata),
//       paused: false,
//       token_metadata: MichelsonMap.fromLiteral([tokenMetadata]),
//       ledger: { [address]: { balance: 100000000000000, approvals: new MichelsonMap() } },
//       total_supply: 100000000000000,
//     },
//   });

//   await operation.confirmation(1);

//   // Wait for the operation to be confirmed
//   console.log(`Operation contract: ${operation.contractAddress}`);
//   console.log(`Operation hash: ${operation.hash}`);
// }

// main()
//   .then(() => {
//     console.log('Done');
//     process.exit(0);
//   })
//   .catch(error => {
//     console.error('Error:', error);
//     process.exit(1);
//   });
