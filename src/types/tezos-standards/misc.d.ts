// https://json-schema.org/draft/2020-12/json-schema-core

/*****************************************************
 * TZip-16
 * Extends TZip-7 and TZip-12
 * https://tzip.tezosagora.org/proposal/tzip-16
 *****************************************************/

type OffChainView<N extends string = string> = {
  name: N;
  description: string;
  implementations: OffChainStorageView[];
  pure: boolean;
};

type OffChainStorageView = OffChainMichelsonStorageView | OffChainRestApiView;

type OffChainMichelsonStorageView = {
  michelsonStorageView: {
    parameter?: MichelsonExpressionExtended;
    returnType: MichelsonExpression;
    code: MichelsonExpressionExtended[];
    annotations?: MichelsonExpressionExtended[];
    version?: string;
  };
};

type OffChainRestApiView = {
  restApiQuery: {
    specificationUri: string;
    baseUri: string;
    path: string;
  };
};

/*****************************************************
 * TZip-21
 * Extends TZip-16
 * https://tzip.tezosagora.org/proposal/tzip-21
 *****************************************************/

// https://tzip.tezosagora.org/proposal/tzip-21/#asset-object
type Asset = {
  contributors: string[];
  publishers: string[];
  date: string;
  blockLevel: number;
  type: string;
  tags: string[];
  genres: string[];
  language: string; // rfc1766
  identifier: string; // e.g. ISBN, DOI, etc…
  rights: string; // e.g. CC0, CC-BY, etc…
  rightsUri: string;
  externalUri: string; // Additional information about the subject or content
  isTransferable: boolean;
  tt1: number; // Maximum seconds the asset metadata should be cached
  formats: Partial<Format>[];
  attributes: Attribute[];
};

// https://tzip.tezosagora.org/proposal/tzip-21/#format-object
type Format = {
  uri: string;
  hash: string;
  mimeType: string;
  fileSize: number;
  fileName: string;
  duration: string;
  dimensions: Dimensions;
  dataRate: DataRate;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#attribute-object
type Attribute = {
  name: string;
  value: string;
  type?: string;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#datarate-object
type DataRate = {
  value: number;
  unit: string;
};

// https://tzip.tezosagora.org/proposal/tzip-21/#dimensions-object
type Dimensions = {
  value: string; // e.g. "1920x1080"
  unit: string; // e.g. "px" for pixels
};

// https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/#license-short-name
type License = {
  name: string;
  details?: string;
};

type Source = {
  tools: string[];
  location: string;
};

type StaticError = {
  error: MichelsonExpression;
  expansion: MichelsonExpression;
  languages?: string[];
};

type DynamicError = {
  view: string;
  languages?: string[];
};
