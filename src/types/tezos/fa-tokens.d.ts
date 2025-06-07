type UnitValue = symbol;

type FA12 = ContractAbstraction<TZip7Entrypoints, TZip7Views, {}, TZip16Storage>;

type FA2 = ContractAbstraction<TZip12Entrypoints, TZip12Views, {}, TZip16Storage>;

type FA = FA12 | FA2;

type MetadataMap = {
  '': string; // URI to the metadata JSON
};

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata-storage--access
type TokenMetadataMap = {
  token_id: string;
  token_info: MichelsonMap<keyof TZip21TokenMetadata>;
};

type TokenData = {
  standard?: 'FA1.2' | 'FA2';
  metadata: Promise<TZip17Metadata | undefined>;
  tokenMetadata: Promise<TZip12TokenMetadata | undefined>;
};

type TokenRecipient = TezosRecipient & { tokenId?: number };
