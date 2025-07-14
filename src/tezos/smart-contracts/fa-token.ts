export { Fa12Token, Fa2Token } from '@/tezos/provider';

// import { castToBigNumber } from '@taquito/rpc';
// import { MichelsonMap, UnitValue } from '@taquito/michelson-encoder';
// import { BigNumber } from 'bignumber.js';

// import { unwrapMichelsonMap } from '@/tezos/encoders';
// import {
//   Fa2Balance,
//   Fa2BalanceRequest,
//   Fa2TransferParams,
//   OperatorUpdate,
//   TZip17Metadata,
//   TZip21TokenMetadata,
// } from '@/tezos/types';
// import { TezosContract, BigMap, TezosStorage } from '@/tezos/smart-contracts';
// import { getFromIpfs, isIpfsLink } from '@/tools/ipfs';
// import { BlockchainInstance } from '@/tezos/provider';
// import { isJson } from '@/tools/utils';
// import { getMetadataStorage, isTezosLink, normalizeTezosUri } from './metadata';

// type TokenMetadata = {
//   token_info?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
//   1?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
// };

// class FaToken extends TezosContract {
//   private readonly storage: TezosStorage;

//   constructor(address: string, script: ScriptResponse, context: BlockchainInstance) {
//     super(address, context);
//     this.storage = new TezosStorage(script, this);
//   }

//   private async resolvePossibleLink<T>(value: string, contractAddress?: string): Promise<T | undefined> {
//     value = value.replace(/[\x00-\x1F\x7F]/g, '');

//     if (isJson(value)) {
//       return JSON.parse(value);
//     }

//     if (isIpfsLink(value)) {
//       return getFromIpfs<T>(value);
//     }

//     if (isTezosLink(value)) {
//       const normalizedUri: string = normalizeTezosUri(value, contractAddress);
//       return getMetadataStorage<T>(normalizedUri, this);
//     }

//     return value as T;
//   }

//   async getMetadata(): Promise<TZip17Metadata | undefined> {
//     const storage: TezosStorage | undefined = await this.storage;
//     const bigMap: BigMap | undefined = await storage?.get<BigMap>('metadata');

//     const result: TZip17Metadata | string | undefined = await bigMap?.get<TZip17Metadata | string>('');

//     if (result === undefined) {
//       const [name, description, version] = await Promise.all([
//         bigMap?.get<string>('name'),
//         bigMap?.get<string>('description'),
//         bigMap?.get<string>('version'),
//       ]);

//       return { name, description, version } as TZip17Metadata;
//     }

//     // If the metadata is not a MichelsonMap, we try to access the standard fields directly
//     return typeof result === 'string' ? this.resolvePossibleLink<TZip17Metadata>(result, this.address) : result;
//   }

//   async getTokenMetadata(tokenId: number = 0): Promise<TZip21TokenMetadata | undefined> {
//     const storage: TezosStorage | undefined = await this.storage;
//     const bigMap: BigMap | undefined = await storage?.get<BigMap>('token_metadata');

//     const tokenMetadata: TokenMetadata | undefined = await bigMap?.get(tokenId);
//     const tokenInfo: unknown = tokenMetadata?.['token_info'] ?? tokenMetadata?.['1'];

//     if (MichelsonMap.isMichelsonMap(tokenInfo)) {
//       const unwrappedMap: TZip21TokenMetadata = unwrapMichelsonMap(tokenInfo);
//       return { ...unwrappedMap, ...castToBigNumber(unwrappedMap, []) };
//     }

//     return tokenInfo as TZip21TokenMetadata;
//   }
// }

// /*****************************************************
//  * TZip-5
//  * FA1 Interface
//  * https://tzip.tezosagora.org/proposal/tzip-5
//  *****************************************************/

// /*****************************************************
//  * TZip-7
//  * FA1.2 Interface
//  * https://tzip.tezosagora.org/proposal/tzip-7
//  *****************************************************/

// export class Fa12Token extends FaToken {
//   constructor(address: string, script: ScriptResponse, context: BlockchainInstance) {
//     super(address, script, context);
//   }

//   async transfer(from: string, to: string, value: BigNumber.Value): Promise<TransactionOperationParameter> {
//     return this.createMethod({ from, to, value: BigNumber(value) }, 'transfer');
//   }

//   async getBalance(address: string): Promise<BigNumber> {
//     return this.executeView<string, BigNumber>(address, 'getBalance');
//   }

//   async getTotalSupply(): Promise<BigNumber> {
//     return this.executeView<typeof UnitValue, BigNumber>(UnitValue, 'getTotalSupply');
//   }
// }

// /*****************************************************
//  * TZip-12
//  * FA2 Interface
//  * https://tzip.tezosagora.org/proposal/tzip-12
//  *****************************************************/

// export class Fa2Token extends FaToken {
//   constructor(address: string, script: ScriptResponse, context: BlockchainInstance) {
//     super(address, script, context);
//   }

//   async balanceOf(args: Fa2BalanceRequest[]): Promise<Fa2Balance[]> {
//     return this.executeView<Fa2BalanceRequest[], Fa2Balance[]>(args, 'balance_of');
//   }

//   async transfer(params: Fa2TransferParams[]): Promise<TransactionOperationParameter> {
//     return this.createMethod(params, 'transfer');
//   }

//   async update_operators(ops: OperatorUpdate[]): Promise<TransactionOperationParameter> {
//     return this.createMethod(ops, 'update_operators');
//   }
// }
