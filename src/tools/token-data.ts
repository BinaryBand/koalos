import 'dotenv/config';

import { RpcReadAdapter, TezosToolkit } from '@taquito/taquito';
import { InMemorySigner } from '@taquito/signer';
import { MichelsonV1Expression, MichelsonV1ExpressionExtended, ScriptedContracts, StorageResponse } from '@taquito/rpc';
import { MichelsonMap, Schema, UnitValue } from '@taquito/michelson-encoder';
import BigNumber from 'bignumber.js';

import { Tzip12Module, tzip12 } from '@taquito/tzip12';
import {
  MetadataEnvelope,
  MichelsonStorageView,
  MichelsonStorageViewType,
  Tzip16Module,
  ViewDefinition,
  ViewImplementation,
  tzip16,
} from '@taquito/tzip16';

const RPC_URLS: string[] = [
  'https://mainnet.tezos.ecadinfra.com/',
  'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
];

const RPC: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
const Tezos: TezosToolkit = new TezosToolkit(RPC);
Tezos.addExtension(new Tzip12Module());
Tezos.addExtension(new Tzip16Module());

const FA12 = {
  kusd: 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV',
  kdao: 'KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH',
  wxtz: 'KT1VYsVfmobT7rsMVivvZ4J8i3bPiqz12NaH',
  tzbtc: 'KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn',
  stkr: 'KT1AEfeckNbdEYwaMKkytBwPJPycz7jdSGea',
  ethtz: 'KT19at7rQUvyjxnZ2fBv7D9zc8rkyG7gAoU8',
  swc: 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g',
};

const FA20: Record<string, [string, number]> = {
  usds: ['KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf', 0],
  hdao: ['KT1AFA2mwNUMNd4SsujE1YYp29vd8BZejyKW', 0],
  crunch: ['KT1Q9b2b1d8c5e3f4c6a7f0b9c8d9e0f1a2b3', 0],
};

Tezos.setProvider({
  signer: new InMemorySigner(process.env['SECRET_KEY']!),
});

interface ITokenMetadata {
  0: typeof BigNumber;
  1: MichelsonMap<string, string>;
}

async function main(): Promise<void> {
  // User wallet address
  const address: string = await Tezos.signer.publicKeyHash();
  console.log('User address:', address);

  const contract_swc = await Tezos.contract.at(FA12.swc, tzip12);
  const contract_kusd = await Tezos.contract.at(FA12.kusd, tzip16);
  const contract_usds = await Tezos.contract.at(FA20.usds[0], tzip16);
  const contract_hdao = await Tezos.contract.at(FA20.hdao[0]);

  const entrypoints: Set<string> = new Set(Object.keys(contract_swc.entrypoints.entrypoints));
  const isTZip_5: boolean = ['transfer', 'getBalance', 'getTotalSupply'].every(ep => entrypoints.has(ep));
  const isTZip_7: boolean = isTZip_5 && ['approve', 'getAllowance'].every(ep => entrypoints.has(ep));
  console.log('Is TZIP-5:', isTZip_5);
  console.log('Is TZIP-7:', isTZip_7);

  // SWC contract
  const script_swc: ScriptedContracts = await Tezos.rpc.getScript(FA12.swc);
  const storageSchema_swc: Schema = Schema.fromRPCResponse({ script: script_swc });
  const storageResponse_swc: StorageResponse = await Tezos.rpc.getStorage(FA12.swc);
  console.log('SWC storage:', storageSchema_swc.Execute(storageResponse_swc));
  console.log('SWC amount', await contract_swc.views.getBalance(address).read());
  console.log('SWC supply', await contract_swc.views.getTotalSupply(UnitValue).read());
  console.log('SWC token metadata', await contract_swc.tzip12().getTokenMetadata(0));

  // KUSD contract
  console.log('KUSD amount', await contract_kusd.views.getBalance(address).read());
  console.log('KUSD supply', await contract_kusd.views.getTotalSupply(UnitValue).read());
  console.log('KUSD metadata', await contract_kusd.tzip16().getMetadata());

  // USDS contract
  console.log('USDS amount', await contract_usds.views.balance_of([{ owner: address, token_id: FA20.usds[1] }]).read());

  const envelope: MetadataEnvelope = await contract_usds.tzip16().getMetadata();
  const tokenMetadata: ViewDefinition | null =
    envelope.metadata.views?.filter(view => view.name === 'token_metadata')[0] ?? null;

  const implementation: ViewImplementation | null = tokenMetadata?.implementations?.[0] ?? null;

  if (implementation) {
    if ('michelsonStorageView' in implementation) {
      const michelsonStorageView: MichelsonStorageViewType = implementation.michelsonStorageView;

      const view: MichelsonStorageView = new MichelsonStorageView(
        'token_metadata',
        contract_usds,
        Tezos.rpc,
        new RpcReadAdapter(Tezos.rpc),
        michelsonStorageView.returnType as MichelsonV1Expression,
        michelsonStorageView.code as MichelsonV1ExpressionExtended[],
        michelsonStorageView.parameter as MichelsonV1ExpressionExtended
      );

      const res: ITokenMetadata = await view.executeView(FA20.usds[1]);

      const metadata: Record<string, string> | undefined = Array.from(res[1].entries())?.reduce(
        (acc: Record<string, string>, [x, y]: [string, string]) => ({ ...acc, [x]: y }),
        {}
      );

      console.log('USDS token metadata:', metadata ?? 'No token info found');
    }
  }

  // HDAO contract
  console.log('HDAO amount', await contract_hdao.views.balance_of([{ owner: address, token_id: FA20.hdao[1] }]).read());
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    console.log('RPC URL:', RPC);
    process.exit(1);
  });
