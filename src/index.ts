// import 'dotenv/config';

// import { BigMapAbstraction, TezosToolkit } from '@taquito/taquito';

// import * as fs from 'fs';
// import * as path from 'path';

// const RPC_URLS: string[] = [
//   'https://mainnet.tezos.ecadinfra.com/',
//   'https://rpc.tzbeta.net/',
//   'https://mainnet.smartpy.io/',
// ];

// const RPC: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
// const Tezos: TezosToolkit = new TezosToolkit(RPC);

// const basePath: string = 'C:/Users/Shane/OneDrive/Documents/Development/js/smart-contracts';
// const tokensPath: string = path.join(basePath, 'blockchain', 'tokens');

// async function main(): Promise<void> {
//   const fa12Path: string = path.join(tokensPath, 'fa12.json');
//   const fa2Path: string = path.join(tokensPath, 'fa2', '0.json');

//   const faData: string = fs.readFileSync(fa12Path, 'utf8');
//   const faTokens: ITokenData[] = JSON.parse(faData);
//   const faWithMetadata: ITokenData[] = faTokens.filter(t => t.metadata && t.metadata?.name);
//   console.log(`Loaded ${faWithMetadata.length} tokens with metadata`);

//   for (let i: number = 0; i < faWithMetadata.length; i++) {
//     const contractAddress: string = faWithMetadata[i].contract.address;
//     const tokenId: string = faWithMetadata[i].tokenId ?? '0';

//     const contract = await Tezos.contract.at(contractAddress);
//     const storage: unknown = await contract.storage();

//     if (storage && typeof storage === 'object' && 'token_metadata' in storage) {
//       const metadataMap: unknown = storage['token_metadata'];
//       if (metadataMap instanceof BigMapAbstraction) {
//         const metadataObject: unknown = await metadataMap.get(tokenId);
//         console.log(metadataObject, 'at', contractAddress, 'for token ID', tokenId);
//         break;
//       }
//     }

//     console.error(`No token metadata found for contract ${contractAddress} and token ID ${tokenId}`);
//   }

//   await new Promise(resolve => setTimeout(resolve, 1000));
//   console.log('All operations completed.');
// }

// main()
//   .then(() => {
//     console.log('Done');
//     process.exit(0);
//   })
//   .catch(error => {
//     console.error('Error:', error);
//     console.log('RPC URL:', RPC);
//     process.exit(1);
//   });

import 'dotenv/config';

import { ContractAbstraction, ContractProvider, TezosToolkit, TransactionOperation } from '@taquito/taquito';
import { MichelsonMap, MichelsonMapKey, Schema, UnitValue } from '@taquito/michelson-encoder';
import { InMemorySigner } from '@taquito/signer';
import { ScriptedContracts, RpcClientCache, RpcClient, MichelsonV1Expression } from '@taquito/rpc';
import BigNumber from 'bignumber.js';

import { unwrapMichelsonMap } from './tools/metadata.js';

const RPC_URLS: string[] = [
  'https://mainnet.tezos.ecadinfra.com/',
  'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
];

const rpc: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
const rpcClient: RpcClient = new RpcClient(rpc);
const rpcClientCache: RpcClientCache = new RpcClientCache(rpcClient);
const Tezos: TezosToolkit = new TezosToolkit(rpcClientCache);

const FA12: Record<string, string | [string, number]> = {
  kusd: 'KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV',
  kdao: 'KT1JkoE42rrMBP9b2oDhbx6EUr26GcySZMUH',
  wxtz: 'KT1VYsVfmobT7rsMVivvZ4J8i3bPiqz12NaH', // Missing metadata
  tzbtc: 'KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn', // Metadata function
  stkr: 'KT1AEfeckNbdEYwaMKkytBwPJPycz7jdSGea', // Missing metadata
  ethtz: 'KT19at7rQUvyjxnZ2fBv7D9zc8rkyG7gAoU8', // Missing metadata
  swc: 'KT19jW4iyZYrU3AGXqhV33Aa73yGWuFe1b2g',
  usds: ['KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf', 0],
  hdao: ['KT1AFA2mwNUMNd4SsujE1YYp29vd8BZejyKW', 0],
  crunch: ['KT1BHCumksALJQJ8q8to2EPigPW6qpyTr7Ng', 0],
  quipu: ['KT193D4vozYnhGJQVtw7CoxxqphqUEEwK6Vb', 0],
  nft: ['KT19WKbn393rm31rt6igCG2TByikYRKKkfmd', 0],
};

Tezos.setProvider({
  signer: new InMemorySigner(process.env['SECRET_KEY']!),
});

async function main(): Promise<void> {
  // User wallet address
  const address: string = await Tezos.signer.publicKeyHash();
  console.log('User address:', address);

  // const contract_swc = await Tezos.contract.at<ContractAbstraction<ContractProvider, any, TZip7Methods, TZip7EViews>>(
  //   FA12.swc
  // );
  // const contract_kusd = await Tezos.contract.at(FA12.kusd);
  // const contract_usds = await Tezos.contract.at<ContractAbstraction<ContractProvider, any, TZip12Methods, TZip12Views>>(
  //   FA20.usds[0]
  // );
  // const contract_hdao = await Tezos.contract.at<ContractAbstraction<ContractProvider, any, TZip12Methods, TZip12Views>>(
  //   FA20.crunch[0]
  // );

  const targetContract: string | [string, number] = FA12.crunch;
  const tokenId: number = typeof targetContract === 'string' ? 0 : targetContract[1];
  const contractAddress: string = typeof targetContract === 'string' ? targetContract : targetContract[0];

  const contract = await Tezos.contract.at(contractAddress);
  const storage: TZip16Storage = await contract.storage<TZip16Storage>();

  if ('metadata' in storage) {
    const metadata: BigMapAbstraction = storage.metadata;
    const faMetadata: MichelsonMap<MichelsonMapKey, unknown> = await metadata.getMultipleValues(['']);
    if (MichelsonMap.isMichelsonMap(faMetadata)) {
      const metadataSchema: MichelsonExpression = metadata['schema']['val'];
      faMetadata.setType(metadataSchema);
      const unwrapped: TZip17Metadata = await unwrapMichelsonMap<TZip17Metadata>(faMetadata, contractAddress);
      console.log('Metadata:', unwrapped);
    }
  }

  let tokenMetadata: BigMapAbstraction | null = 'token_metadata' in storage ? storage.token_metadata : null;
  tokenMetadata ??= 'assets' in storage ? storage.assets.token_metadata : null;
  if (tokenMetadata !== null) {
    const faTokenMetadata: Record<string, unknown> | undefined = await tokenMetadata.get(tokenId);
    if (faTokenMetadata !== undefined) {
      const tokenInfo: unknown = faTokenMetadata['token_info'] ?? faTokenMetadata['1'];
      if (MichelsonMap.isMichelsonMap(tokenInfo)) {
        const unwrapped: TZip21TokenMetadata = await unwrapMichelsonMap<TZip21TokenMetadata>(tokenInfo);
        console.log('Token metadata:', unwrapped);
      }
    }
  }

  // let metadata: BigMap<TZip16Metadata> | false = 'metadata' in storage ? storage.metadata : false;
  // if (metadata !== false) {
  //   const faMetadata = await metadata.getMultipleValues(['']);

  //   if (MichelsonMap.isMichelsonMap(faMetadata)) {
  //     const unwrapped: TZip17Metadata = await unwrapMichelsonMap<TZip17Metadata>(faMetadata);
  //     console.log('Metadata:', unwrapped);
  //   }
  // }

  // // SWC contract
  // const script_swc: ScriptedContracts = await Tezos.rpc.getScript(FA12.swc);
  // const storageSchema_swc: Schema = Schema.fromRPCResponse({ script: script_swc });
  // console.log('SWC storage:', storageSchema_swc.Execute(script_swc.storage));
  // const swcTransferParams: FA1TransferParams = { from: address, to: address, value: new BigNumber(1) };
  // const swcTransferOp: TransactionOperation = await contract_swc.methodsObject.transfer(swcTransferParams).send();
  // const swcTransferRes: boolean = swcTransferOp.operationResults[0].metadata.operation_result.status === 'applied';
  // console.log('SWC transfer result:', swcTransferRes ? 'Success' : 'Failed');
  // const swcApproveParams: FA12ApproveParams = { spender: address, value: new BigNumber(0) };
  // const swcApproveOp: TransactionOperation = await contract_swc.methodsObject.approve(swcApproveParams).send();
  // const swcApprove: boolean = swcApproveOp.operationResults[0].metadata.operation_result.status === 'applied';
  // console.log('SWC approve result:', swcApprove ? 'Success' : 'Failed');
  // console.log('SWC amount', await contract_swc.views.getBalance(address).read());
  // console.log('SWC supply', await contract_swc.views.getTotalSupply(UnitValue).read());

  // // KUSD contract
  // console.log('KUSD amount', await contract_kusd.views.getBalance(address).read());
  // console.log('KUSD supply', await contract_kusd.views.getTotalSupply(UnitValue).read());
  // console.log('KUSD metadata', await contract_kusd.tzip16().getMetadata());

  // // USDS contract
  // const swcTransferParams: Fa2TransferParams = {
  //   from_: address,
  //   txs: [{ to_: address, token_id: FA20.usds[1], amount: new BigNumber(1) }],
  // };
  // const swcTransferOp: TransactionOperation = await contract_usds.methodsObject.transfer([swcTransferParams]).send();
  // const swcTransferRes: boolean = swcTransferOp.operationResults[0].metadata.operation_result.status === 'applied';
  // console.log('USDS transfer result:', swcTransferRes ? 'Success' : 'Failed');
  // const swcOperatorsParams: Fa2UpdateOperatorParams = {
  //   add_operator: { owner: address, operator: address, token_id: FA20.usds[1] },
  // };
  // const swcOperatorsOp: TransactionOperation = await contract_usds.methodsObject
  //   .update_operators([swcOperatorsParams])
  //   .send();
  // const swcOperatorsRes: boolean = swcOperatorsOp.operationResults[0].metadata.operation_result.status === 'applied';
  // console.log('USDS operators update result:', swcOperatorsRes ? 'Success' : 'Failed');
  // console.log('USDS amount', await contract_usds.views.balance_of([{ owner: address, token_id: FA20.usds[1] }]).read());

  // const envelope: MetadataEnvelope = await contract_usds.tzip16().getMetadata();
  // const tokenMetadata: ViewDefinition | null =
  //   envelope.metadata.views?.filter(view => view.name === 'token_metadata')[0] ?? null;

  // const implementation: ViewImplementation | null = tokenMetadata?.implementations?.[0] ?? null;

  // if (implementation) {
  //   if ('michelsonStorageView' in implementation) {
  //     const michelsonStorageView: MichelsonStorageViewType = implementation.michelsonStorageView;

  //     const view: MichelsonStorageView = new MichelsonStorageView(
  //       'token_metadata',
  //       contract_usds,
  //       Tezos.rpc,
  //       new RpcReadAdapter(Tezos.rpc),
  //       michelsonStorageView.returnType as MichelsonV1Expression,
  //       michelsonStorageView.code as MichelsonV1ExpressionExtended[],
  //       michelsonStorageView.parameter as MichelsonV1ExpressionExtended
  //     );

  //     const res: ITokenMetadata = await view.executeView(FA20.usds[1]);

  //     const metadata: Record<string, string> | undefined = Array.from(res[1].entries())?.reduce(
  //       (acc: Record<string, string>, [x, y]: [string, string]) => ({ ...acc, [x]: y }),
  //       {}
  //     );

  //     console.log('USDS token metadata:', metadata ?? 'No token info found');
  //   }
  // }

  // // HDAO contract
  // console.log('HDAO amount', await contract_hdao.views.balance_of([{ owner: address, token_id: FA20.hdao[1] }]).read());
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    console.log('RPC URL:', rpc);
    process.exit(1);
  });
