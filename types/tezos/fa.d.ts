type FA12 = import('@taquito/taquito').ContractAbstraction<
  ContractProvider,
  {},
  TZip7Entrypoints,
  TZip7Views,
  {},
  TZip16Storage
>;

type FA2 = import('@taquito/taquito').ContractAbstraction<
  ContractProvider,
  {},
  TZip12Entrypoints,
  TZip12Views,
  {},
  TZip16Storage
>;

type FA = FA12 | FA2;

type MetadataMap = {
  '': string; // URI to the metadata JSON
};

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata-storage--access
type TokenMetadataMap = {
  token_id: string;
  token_info: MichelsonMap<keyof TZip21TokenMetadata>;
};

type TokenRecipient = TezosRecipient & { tokenId?: number };
