import 'dotenv/config';

import { BigMapAbstraction, MichelsonMap, TezosToolkit } from '@taquito/taquito';
// import { TokenMetadata, Tzip12Module, tzip12 } from '@taquito/tzip12';
// import { ScriptedContracts, StorageResponse } from '@taquito/rpc';
import { MichelsonMapKey, Schema } from '@taquito/michelson-encoder';
// import BigNumber from 'bignumber.js';

// import { assert } from './misc';

import { isIpfsLink, getFromIpfs } from './networks/ipfs.js';
import { isTezosLink, getFromTezos } from './networks/tezos.js';
import { isJson } from './misc.js';

// import * as fs from 'fs';
// import * as path from 'path';

// const RPC_URLS: string[] = [
//   'https://mainnet.tezos.ecadinfra.com/',
//   'https://rpc.tzbeta.net/',
//   'https://mainnet.smartpy.io/',
// ];

// const RPC: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
// const Tezos: TezosToolkit = new TezosToolkit(RPC);
// Tezos.addExtension(new Tzip12Module());

// const basePath: string = 'C:/Users/Shane/OneDrive/Documents/Development/js/smart-contracts';
// const tokensPath: string = path.join(basePath, 'blockchain', 'tokens');

function unpackMichelsonPrimitive(value: unknown, valueSchema?: Schema): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (valueSchema && 'prim' in valueSchema.val && valueSchema.val.prim) {
    switch (valueSchema.val.prim) {
      case 'bytes':
        return Buffer.from(value, 'hex').toString('utf8');
      case 'timestamp':
        return new Date(value);
    }
  }

  if (MichelsonMap.isMichelsonMap(value)) {
    return unwrapMichelsonMap(value);
  }

  return value;
}

export async function unwrapMichelsonMap<O extends Record<string, unknown>>(
  curr: MichelsonMap<MichelsonMapKey, unknown>,
  contractAddress?: string
): Promise<O> {
  const valueSchema: Schema = curr['valueSchema'];

  // Transform the MichelsonMap into a regular object
  let map: O = Array.from(curr.entries())
    .filter(([_key, val]: [MichelsonMapKey, unknown]) => Boolean(val))
    .reduce((acc: O, [key, val]: [MichelsonMapKey, unknown]) => {
      const value: unknown = unpackMichelsonPrimitive(val, valueSchema);
      return { ...acc, [`${key}`]: value };
    }, {} as O);

  // If the map has an empty string key, it might be a link to metadata
  if ('' in map && typeof map[''] === 'string') {
    // Check if the link is an IPFS or Tezos link
    let metadata: unknown;
    if (isIpfsLink(map[''])) {
      metadata = await getFromIpfs(map['']);
    } else if (isTezosLink(map[''])) {
      metadata = await getFromTezos(map[''], contractAddress);
    }

    // If the metadata is a string and looks like JSON, parse it
    if (typeof metadata === 'string' && isJson(metadata)) {
      metadata = JSON.parse(metadata);
    }

    // Remove the link after unwrapping and merge metadata into root
    if (typeof metadata === 'object' && metadata !== null) {
      map = { ...map, ...metadata } as O;
      delete map[''];
    }
  }

  return map;
}

// export async function findMetadata(curr: unknown): Promise<IMetadata | undefined> {
//   if (MichelsonMap.isMichelsonMap(curr)) {
//     curr = unwrapMichelsonMap(curr);
//   }

//   if (typeof curr === 'object' && curr !== null) {
//     if ('name' in curr && 'symbol' in curr) {
//       return curr as IMetadata;
//     }

//     for (const value of Object.values(curr)) {
//       if (/^ipfs:\/\/([a-zA-Z0-9]{46}|[a-zA-Z0-9]{59})$/.test(value)) {
//         const result: IMetadata | undefined = await findMetadataFromIpfs(value);
//         if (result) return result;
//       }

//       const result: IMetadata | undefined = await findMetadata(value);
//       if (result) return result;
//     }
//   }

//   return undefined;
// }

// // async function main(): Promise<void> {
// //   const fa12Path: string = path.join(tokensPath, 'fa12.json');
// //   const fa12Data: string = fs.readFileSync(fa12Path, 'utf8');

// //   const fa12: ITokenData[] = JSON.parse(fa12Data);
// //   console.log(`Loaded ${fa12.length} FA1.2 tokens from ${fa12Path}`);

// //   const fa12WithMetadata: ITokenData[] = fa12.filter(
// //     t =>
// //       t.metadata &&
// //       t.metadata.name &&
// //       t.firstMinter.address !== 'tz1cmAfyjWW3Rf3tH3M3maCpwsiAwBKbtmG4' && // No need to check PNLP
// //       t.contract.address !== 'tz1NbDzUQCcV2kp3wxdVHVSZEDeq2h97mweW' && // No need to check PLENTY
// //       t.contract.address !== 'KT1LN4LPSqTMS7Sd2CJw4bbDGRkMv2t68Fy9' &&
// //       t.contract.address !== 'KT19at7rQUvyjxnZ2fBv7D9zc8rkyG7gAoU8' &&
// //       t.contract.address !== 'KT1VYsVfmobT7rsMVivvZ4J8i3bPiqz12NaH' &&
// //       t.contract.address !== 'KT1AEfeckNbdEYwaMKkytBwPJPycz7jdSGea' &&
// //       t.contract.address !== 'KT19DUSZw7mfeEATrbWVPHRrWNVbNnmfFAE6' && // Missing IPFS
// //       t.contract.address !== 'KT1LqEyTQxD2Dsdkk4LME5YGcBqazAwXrg4t' && // Missing IPFS
// //       t.contract.address !== 'KT1AafHA1C1vk959wvHWBispY9Y2f3fxBUUo' // No metadata
// //   );
// //   console.log(`${fa12WithMetadata.length} FA1.2 tokens with metadata`);

// //   for (let i: number = 328; i < fa12WithMetadata.length; i++) {
// //     const target: string = fa12WithMetadata[i].contract.address;
// //     const contract = await Tezos.contract.at(target, tzip12);

// //     console.log(`Processing contract ${target} (${i + 1}/${fa12WithMetadata.length})`);

// //     // Plan A
// //     const isTzip12: boolean = await contract.tzip12().isTzip12Compliant();
// //     if (isTzip12) {
// //       const metadata: TokenMetadata = await contract.tzip12().getTokenMetadata(0);
// //       console.log(`A: Contract ${target} metadata:`, metadata);
// //       continue;
// //     }

// //     // Plan B
// //     const hasView: boolean = Boolean('getTokenMetadata' in contract.entrypoints.entrypoints);
// //     if (hasView) {
// //       const metadata = await contract.views.getTokenMetadata([0]).read();
// //       metadata.forEach((meta: any, i: number) => {
// //         console.log(`B: Contract ${target}[${i}] metadata:`);
// //         const data: Record<string, unknown> = meta;

// //         for (const [key, value] of Object.entries(data)) {
// //           if (value instanceof BigNumber) {
// //             console.log(`\t${key}: ${value.toString()}`);
// //           } else if (value instanceof MichelsonMap) {
// //             const map = Array.from(value.entries()).reduce((acc: any, [k, v]) => {
// //               acc[k] = v;
// //               return acc;
// //             }, {});
// //             console.log(`\t${key}:`, JSON.stringify(map, null, 2));
// //           } else {
// //             console.log(`\t${key}: ${value}`);
// //           }
// //         }
// //       });
// //       continue;
// //     }

// //     // Plan C
// //     const storage: unknown = await contract.storage();
// //     if (storage && typeof storage === 'object') {
// //       let metadataMap: unknown = undefined;
// //       if ('token_metadata' in storage) {
// //         metadataMap = storage['token_metadata'];
// //       } else if ('metadata' in storage) {
// //         metadataMap = storage['metadata'];
// //       }

// //       if (metadataMap instanceof BigMapAbstraction) {
// //         // Let's try using some default values to fetch metadata
// //         const data: unknown = await metadataMap.getMultipleValues(['', '0', '1']);

// //         if (MichelsonMap.isMichelsonMap(data)) {
// //           const metadataSchema: Schema = metadataMap['schema'];
// //           data.setType(metadataSchema.val);

// //           const metadata: IMetadata | undefined = await findMetadata(data);
// //           if (metadata) {
// //             console.log(`C: Contract ${target} token metadata:`, metadata);
// //             continue;
// //           }
// //         }
// //       }
// //     }

// //     // Plan D
// //     const script: ScriptedContracts = await Tezos.rpc.getScript(target);
// //     const storageSchema: Schema = Schema.fromRPCResponse({ script });
// //     const storageResponse: StorageResponse = await Tezos.rpc.getStorage(target);
// //     const storageView: unknown = storageSchema.Execute(storageResponse);
// //     if (typeof storageView === 'object' && storageView !== null) {
// //       const metadata: IMetadata | undefined = await findMetadata(storageView);
// //       if (metadata) {
// //         console.log(`D: Contract ${target} storage view metadata:`, metadata);
// //         continue;
// //       }
// //     }

// //     console.log(`Contract ${target} does not support TZIP-12 or getTokenMetadata view.`);
// //     break;
// //   }

// //   await new Promise(resolve => setTimeout(resolve, 1000));
// //   console.log('All operations completed.');
// // }

// // main()
// //   .then(() => {
// //     console.log('Done');
// //     process.exit(0);
// //   })
// //   .catch(error => {
// //     console.error('Error:', error);
// //     console.log('RPC URL:', RPC);
// //     process.exit(1);
// //   });
