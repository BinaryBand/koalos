//json-schema.org/draft/2020-12/json-schema-core

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
  formats: Partial<import('@/index').Format>[];
  attributes: Attribute[];
};

// https://tzip.tezosagora.org/proposal/tzip-21/#attribute-object
type Attribute = {
  name: string;
  value: string;
  type?: string;
};
