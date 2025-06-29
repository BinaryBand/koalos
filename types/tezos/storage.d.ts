interface IStorage {
  getValue<T = unknown>(key: Primitive): Promise<T | undefined>;
}

type StorageResponse = Record<string, string | BigNumber | IStorage | { [key: string]: StorageResponse }>;

type TokenMetadata = {
  token_info?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
  1?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
};
