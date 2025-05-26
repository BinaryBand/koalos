import 'module-alias/register';
import 'dotenv/config';

import { ParamsWithKind, PreparedOperation, TezosToolkit } from '@taquito/taquito';
import { InMemorySigner } from '@taquito/signer';

import { Tzip12Module, tzip12 } from '@taquito/tzip12';
import { Tzip16Module, tzip16 } from '@taquito/tzip16';
import { OpKind, PreapplyParams, PreapplyResponse } from '@taquito/rpc';

import { BigNumber } from 'bignumber.js';
import { assert } from '@/tools/misc';

const RPC_URLS: string[] = [
  'https://mainnet.tezos.ecadinfra.com/',
  'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
];

const RPC: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
const Tezos: TezosToolkit = new TezosToolkit(RPC);
Tezos.addExtension(new Tzip12Module());
Tezos.addExtension(new Tzip16Module());

const FA12_TOKENS = {
  kusd: 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV',
  kdao: 'KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH',
  wxtz: 'KT1VYsVfmobT7rsMVivvZ4J8i3bPiqz12NaH',
  tzbtc: 'KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn',
  stkr: 'KT1AEfeckNbdEYwaMKkytBwPJPycz7jdSGea',
  ethtz: 'KT19at7rQUvyjxnZ2fBv7D9zc8rkyG7gAoU8',
};

const FA20_TOKENS = {
  swc: 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g',
  usds: 'KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf',
  hdao: 'KT1AFA2mwNUMNd4SsujE1YYp29vd8BZejyKW',
};

Tezos.setProvider({
  signer: new InMemorySigner(process.env['SECRET_KEY']!),
});

async function getPublicKey(address: string): Promise<string> {
  const wallet = await Tezos.rpc.getManagerKey(address);
  return wallet.toString();
}

async function getBalance(address: string): Promise<BigNumber> {
  const balance = await Tezos.rpc.getBalance(address);
  assert(balance !== undefined, 'Balance is undefined');
  return new BigNumber(balance.toString());
}

async function main(): Promise<void> {
  // User wallet address
  const address: string = await Tezos.signer.publicKeyHash();
  console.log('User address:', address);

  // rpc/mainnet/chains/main/blocks/head/context/contracts/$target/manager_key
  const publicKey: string = await getPublicKey(address);
  console.log('User public key:', publicKey);

  // rpc/mainnet/chains/main/blocks/head/context/contracts/$target/balance
  const balance: BigNumber = await getBalance(address);
  console.log('User balance:', balance.toString());

  const virtualWalletAddress: string = 'KT1VSmQrkbWXN4n9wFTFsDfXrpASsoCngnWz';

  const transferParams: ParamsWithKind[] = Object.values(FA12_TOKENS).map(token => ({
    kind: OpKind.TRANSACTION,
    to: token,
    amount: 0,
    parameter: {
      entrypoint: 'getBalance',
      value: { prim: 'Pair', args: [{ string: address }, { string: `${virtualWalletAddress}%receive_balance` }] },
    },
  }));

  const prepared: PreparedOperation = await Tezos.prepare.batch(transferParams);
  const params: PreapplyParams = await Tezos.prepare.toPreapply(prepared);
  const preapplyOp: PreapplyResponse[] = await Tezos.rpc.preapplyOperations(params);
  for (const op of preapplyOp) {
    for (const content of op.contents) {
      if (content.kind === OpKind.TRANSACTION) {
        for (const internal of content.metadata.internal_operation_results ?? []) {
          if (internal.kind === OpKind.TRANSACTION) {
            assert('storage' in internal.result, 'Storage value expected in internal operation result');
            const source: string = internal.source;
            console.log(source, internal.result['storage']);
          }
        }
      }
    }
  }

  /*******************************
   * FA20 Contract Interaction
   *******************************/
  for (const [name, token] of Object.entries(FA12_TOKENS)) {
    continue;

    // const contract = await Tezos.contract.at(token, compose(tzip12, tzip16));

    // const isTzip12: boolean = await contract.tzip12().isTzip12Compliant();
    // if (isTzip12) {
    //   // contract.tzip12().
    //   // metadata = await contract.tzip12().getTokenMetadata(0);
    //   continue;
    // }

    // const balanceParams: [string, string] = [address, `${virtualWalletAddress}%receive_balance`];
    // const getBalance: (param: [string, string]) => ContractMethodObject<ContractProvider> =
    //   contract.methodsObject['getBalance'];
    // const transferParams: TransferParams = getBalance(balanceParams).toTransferParams();
    // console.log(`${name} transfer params:`, JSON.stringify(transferParams, null, 2));

    // const prepared: PreparedOperation = await Tezos.prepare.batch([
    //   { kind: OpKind.TRANSACTION, ...transferParams },
    //   { kind: OpKind.TRANSACTION, ...transferParams },
    // ]);

    //     const transferParams: TransferParams = {
    //   "entrypoint": "getBalance",
    //   "value": {
    //     "prim": "Pair",
    //     "args": [
    //       {
    //         "string": "tz1TEGKFN9pUpLPvLZXgGjuVoWaebfJS9tuh"
    //       },
    //       {
    //         "string": "KT1VSmQrkbWXN4n9wFTFsDfXrpASsoCngnWz%receive_balance"
    //       }
    //     ]
    //   }
    // }

    // const transferParams = {
    //   to: token,
    //   amount: 0,
    //   mutez: false,
    //   parameter: {
    //     entrypoint: 'getBalance',
    //     value: {
    //       prim: 'Pair',
    //       args: [{ string: address }, { string: `${virtualWalletAddress}%receive_balance` }],
    //     },
    //   },
    // };

    // const prepared = await Tezos.prepare.transaction(transferParams);
    // const params: PreapplyParams = await Tezos.prepare.toPreapply(prepared);
    // const preapplyOp: PreapplyResponse[] = await Tezos.rpc.preapplyOperations(params);
    // for (const op of preapplyOp) {
    //   for (const content of op.contents) {
    //     if (content.kind === OpKind.TRANSACTION) {
    //       for (const internal of content.metadata.internal_operation_results ?? []) {
    //         if (internal.kind === OpKind.TRANSACTION) {
    //           assert('storage' in internal.result, 'Storage value expected in internal operation result');
    //           console.log(name, internal.result['storage']);
    //         }
    //       }
    //     }
    //   }
    // }

    // const res = await operation.send();
    // console.log('Operation:', res);
    // const contract = await tezos.contract.at(token, compose(tzip12, tzip16));
    // const isTzip12: boolean = await contract.tzip12().isTzip12Compliant();
    // let metadata = {};
    // if (isTzip12) {
    //   metadata = await contract.tzip12().getTokenMetadata(0);
    // } else {
    // }
    // console.log(`${name}:`, isTzip12, metadata);
  }
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    // console.log('RPC URL:', RPC);
    process.exit(1);
  });
