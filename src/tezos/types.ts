// https://tzip.tezosagora.org/

import type { MichelsonMap } from '@taquito/taquito';
import type { BigMap } from '@/tezos/contracts/storage';

export type Fa2TransferParams = {
  from_: string;
  txs: { to_: string; token_id: number; amount: BigNumber }[];
};

export type Fa2BalanceRequest = {
  owner: string;
  token_id: BigNumber.Value;
};

export type Fa2Balance = {
  request: { owner: string; token_id: BigNumber[] };
  balance: BigNumber;
};

export type OperatorUpdate =
  | { add_operator: { owner: string; operator: string; token_id: number } }
  | { remove_operator: { owner: string; operator: string; token_id: number } };

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata
export type TZip12TokenMetadata = {
  name?: string;
  symbol?: string; // e.g. XTZ, EUR, etc…
  decimals: string;
};

// https://tzip.tezosagora.org/proposal/tzip-12/#token-metadata
export type TZip12Storage = Record<string, unknown> & {
  token_metadata?: BigMap;
  assets?: TZip12Storage;
};

// https://tzip.tezosagora.org/proposal/tzip-16/#metadata-json-format
// TODO: https://tzip.tezosagora.org/proposal/tzip-12/permissions-policy.md#exposing-permissions-descriptor
export type TZip16Metadata = {
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

export type TZip16Storage = TZip12Storage & {
  metadata: BigMap;
};

export type TZip17Metadata = TZip16Metadata & {
  views: [OffChainView<'GetDefaultExpiry'>, OffChainView<'GetCounter'>, ...OffChainView[]];
};

// https://tzip.tezosagora.org/proposal/tzip-21/#fungible-token-recommendations
export type TZip21TokenMetadata = TZip12TokenMetadata & {
  shouldPreferSymbol?: boolean;
  thumbnailUri?: string;
};

export type TokenMetadata = {
  token_info?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
  1?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#semi-fungible-and-nft-token-recommendations
export type NftMetadata = {
  artifactUri: string;
  displayUri: string;
  thumbnailUri: string; // Recommend maximum size of 350x350px
  description: string;
  minter: string;
  creators: string[];
  isBooleanAmount: boolean; // Whether a holder can have exactly one or zero
};

// https://tzip.tezosagora.org/proposal/tzip-21/#multimedia-nft-token-recommendations
export type MultimediaNftMetadata = NftMetadata & {
  formats: Format[];
  tags: string[];
};

// https://tzip.tezosagora.org/proposal/tzip-16
export type OffChainView<N extends string = string> = {
  name: N;
  description: string;
  implementations: (OffChainMichelsonStorageView | OffChainRestApiView)[];
  pure: boolean;
};

export type OffChainMichelsonStorageView = {
  michelsonStorageView: {
    parameter?: MichelsonV1ExpressionExtended;
    returnType: MichelsonV1Expression;
    code: MichelsonV1ExpressionExtended[];
    annotations?: MichelsonV1ExpressionExtended[];
    version?: string;
  };
};

export type OffChainRestApiView = {
  restApiQuery: {
    specificationUri: string;
    baseUri: string;
    path: string;
  };
};

// https://tzip.tezosagora.org/proposal/tzip-21/#format-object
export type Format = {
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
export type DataRate = {
  value: number;
  unit: string;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#dimensions-object
export type Dimensions = {
  value: string; // e.g. "1920x1080"
  unit: string; // e.g. "px" for pixels
};

// https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/#license-short-name
export type License = {
  name: string;
  details?: string;
};

export type Source = {
  tools: string[];
  location: string;
};

export type StaticError = {
  error: MichelsonV1Expression;
  expansion: MichelsonV1Expression;
  languages?: string[];
};

export type DynamicError = {
  view: string;
  languages?: string[];
};

export type MichelsonView = MichelsonV1ExpressionExtended & {
  prim: 'pair';
  args: [MichelsonV1Expression, { prim: 'contract'; args: [MichelsonV1Expression] }];
};
