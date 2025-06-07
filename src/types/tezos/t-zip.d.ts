// https://tzip.tezosagora.org/

/*****************************************************
 * TZip-5
 * FA1 Interface
 * https://tzip.tezosagora.org/proposal/tzip-5
 *****************************************************/

// https://tzip.tezosagora.org/proposal/tzip-5/#entrypoints
type TZip5Entrypoints = {
  transfer: (params: { from: string; to: string; value: BigNumber }) => ContractMethodObject;
};

type TZip5Views = {
  getBalance: (owner: string) => ContractView<BigNumber>;
  getTotalSupply: (unit: UnitValue) => ContractView<BigNumber>;
};

/*****************************************************
 * TZip-7
 * FA1.2 Interface
 * https://tzip.tezosagora.org/proposal/tzip-7
 *****************************************************/

// https://tzip.tezosagora.org/proposal/tzip-7/#entrypoints
type TZip7Entrypoints = TZip5Entrypoints & {
  approve: (params: { spender: string; value: BigNumber }) => ContractMethodObject;
};

type TZip7Views = TZip5Views & {
  getAllowance: (owner: string, spender: string) => ContractView<BigNumber>;
};

/*****************************************************
 * TZip-12
 * FA2 Interface
 * https://tzip.tezosagora.org/proposal/tzip-12
 *****************************************************/

type Txs = {
  to_: string; // Recipient address
  token_id: number; // Token ID
  amount: BigNumber; // Amount to transfer
};

type OpModifier = {
  owner: string;
  operator: string;
  token_id: number;
};

// https://tzip.tezosagora.org/proposal/tzip-12/#interface-specification
type TZip12Entrypoints = {
  transfer: (params: { from_: string; txs: Txs[] }[]) => ContractMethodObject;
  balance_of: (params: { owner: string; token_id: number }[]) => ContractMethodObject;
  update_operators: (ops: ({ add_operator: OpModifier } | { remove_operator: OpModifier })[]) => ContractMethodObject;
};

type TZip12Views = {
  balance_of: (
    params: { owner: string; token_id: number }[]
  ) => ContractView<{ request: { owner: string; token_id: BigNumber[] }; balance: BigNumber }[]>;
};

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata
type TZip12TokenMetadata = {
  name?: string;
  symbol?: string; // e.g. XTZ, EUR, etc…
  decimals: `${number}`;
};

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata
type TZip12StorageTokenMetadata = {
  token_metadata: BigMapAbstraction;
};

type TZip12StorageAssetsTokenMetadata = {
  assets: {
    token_metadata: BigMapAbstraction;
  };
};

type TZip12Storage = TZip12StorageTokenMetadata | TZip12StorageAssetsTokenMetadata;

/*****************************************************
 * TZip-16
 * https://tzip.tezosagora.org/proposal/tzip-16
 *****************************************************/

// https://tzip.tezosagora.org/proposal/tzip-16/#metadata-json-format
// TODO: https://tzip.tezosagora.org/proposal/tzip-12/permissions-policy.md#exposing-permissions-descriptor
type TZip16Metadata = {
  name?: string;
  description?: string;
  version?: string;
  license?: License;
  authors?: string[];
  homepage?: string;
  source?: Source;
  interfaces: string[];
  errors?: (StaticError | DynamicError)[];
  views?: OffChainView[];
  permissions?: unknown[];
};

type TZip16Storage = TZip12Storage & {
  metadata: BigMapAbstraction;
};

/*****************************************************
 * TZip-17
 * https://tzip.tezosagora.org/proposal/tzip-17
 *****************************************************/

type GetDefaultExpiry = OffChainView<'GetDefaultExpiry'>;
type GetCounter = OffChainView<'GetCounter'>;
type TZip17Metadata = TZip16Metadata & {
  views: [GetDefaultExpiry, GetCounter, ...OffChainView[]];
};

/*****************************************************
 * TZip-21
 * https://tzip.tezosagora.org/proposal/tzip-21
 *****************************************************/

// https://tzip.tezosagora.org/proposal/tzip-21/#fungible-token-recommendations
type TZip21TokenMetadata = TZip12TokenMetadata & {
  shouldPreferSymbol?: boolean;
  thumbnailUri?: string;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#semi-fungible-and-nft-token-recommendations
type NftMetadata = {
  artifactUri: string;
  displayUri: string;
  thumbnailUri: string; // Recommend maximum size of 350x350px
  description: string;
  minter: string;
  creators: string[];
  isBooleanAmount: boolean; // Whether a holder can have exactly one or zero
};

// https://tzip.tezosagora.org/proposal/tzip-21/#multimedia-nft-token-recommendations
type MultimediaNftMetadata = NftMetadata & {
  formats: Format[];
  tags: string[];
};
