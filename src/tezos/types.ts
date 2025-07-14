// https://tzip.tezosagora.org/

import type { BigMap } from '@/tezos/smart-contracts';

export declare type Fa2TransferParams = {
  from_: string;
  txs: { to_: string; token_id: number; amount: BigNumber }[];
};

export declare type Fa2BalanceRequest = {
  owner: string;
  token_id: BigNumber.Value;
};

export declare type Fa2Balance = {
  request: { owner: string; token_id: BigNumber[] };
  balance: BigNumber;
};

export declare type OperatorUpdate =
  | { add_operator: { owner: string; operator: string; token_id: number } }
  | { remove_operator: { owner: string; operator: string; token_id: number } };

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata
export declare type TZip12TokenMetadata = {
  name?: string;
  symbol?: string; // e.g. XTZ, EUR, etc…
  decimals: string;
};

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata
export declare type TZip12Storage = Record<string, unknown> & {
  token_metadata?: BigMap;
  assets?: TZip12Storage;
};

// https://tzip.tezosagora.org/proposal/tzip-16/#metadata-json-format
// TODO: https://tzip.tezosagora.org/proposal/tzip-12/permissions-policy.md#exposing-permissions-descriptor
export declare type TZip16Metadata = {
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

export declare type TZip16Storage = TZip12Storage & {
  metadata: BigMap;
};

export declare type TZip17Metadata = TZip16Metadata & {
  views: [OffChainView<'GetDefaultExpiry'>, OffChainView<'GetCounter'>, ...OffChainView[]];
};

// https://tzip.tezosagora.org/proposal/tzip-21/#fungible-token-recommendations
export declare type TZip21TokenMetadata = TZip12TokenMetadata & {
  shouldPreferSymbol?: boolean;
  thumbnailUri?: string;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#semi-fungible-and-nft-token-recommendations
export declare type NftMetadata = {
  artifactUri: string;
  displayUri: string;
  thumbnailUri: string; // Recommend maximum size of 350x350px
  description: string;
  minter: string;
  creators: string[];
  isBooleanAmount: boolean; // Whether a holder can have exactly one or zero
};

// https://tzip.tezosagora.org/proposal/tzip-21/#multimedia-nft-token-recommendations
export declare type MultimediaNftMetadata = NftMetadata & {
  formats: Format[];
  tags: string[];
};

// https://tzip.tezosagora.org/proposal/tzip-16
export declare type OffChainView<N extends string = string> = {
  name: N;
  description: string;
  implementations: (OffChainMichelsonStorageView | OffChainRestApiView)[];
  pure: boolean;
};

export declare type OffChainMichelsonStorageView = {
  michelsonStorageView: {
    parameter?: MichelsonV1ExpressionExtended;
    returnType: MichelsonV1Expression;
    code: MichelsonV1ExpressionExtended[];
    annotations?: MichelsonV1ExpressionExtended[];
    version?: string;
  };
};

export declare type OffChainRestApiView = {
  restApiQuery: {
    specificationUri: string;
    baseUri: string;
    path: string;
  };
};

// https://tzip.tezosagora.org/proposal/tzip-21/#format-object
export declare type Format = {
  uri: string;
  hash: string;
  mimeType: string;
  fileSize: number;
  fileName: string;
  duration: string;
  dimensions: Dimensions;
  dataRate: DataRate;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#datarate-object
export declare type DataRate = {
  value: number;
  unit: string;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#dimensions-object
export declare type Dimensions = {
  value: string; // e.g. "1920x1080"
  unit: string; // e.g. "px" for pixels
};

// https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/#license-short-name
export declare type License = {
  name: string;
  details?: string;
};

export declare type Source = {
  tools: string[];
  location: string;
};

export declare type StaticError = {
  error: MichelsonV1Expression;
  expansion: MichelsonV1Expression;
  languages?: string[];
};

export declare type DynamicError = {
  view: string;
  languages?: string[];
};
