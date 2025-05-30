type UnitValue = symbol;

// type BigMap<T> = BigMapAbstraction & {
//   get(keyToEncode: BigMapKeyType, block?: number): Promise<T | undefined>;
// };

type MetadataMap = {
  '': string; // URI to the metadata JSON
};

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata-storage--access
type TokenMetadataMap = {
  token_id: string;
  token_info: MichelsonMap<keyof TZip21TokenMetadata>;
};

// interface ITokenData {
//   id: number;
//   contract: TzAddress;
//   tokenId?: string;
//   standard: Standard;
//   firstMinter: TzAddress;
//   firstLevel: number;
//   firstTime: string;
//   lastLevel: number;
//   lastTime: string;
//   transfersCount: number;
//   balancesCount: number;
//   holdersCount: number;
//   totalMinted: string;
//   totalBurned: string;
//   totalSupply: string;
//   metadata?: BaseTokenMetadata;
// }
