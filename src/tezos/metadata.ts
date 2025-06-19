import { decodeMichelsonValue, unwrapMichelsonMap } from '@/tezos/michelson';
import { MichelsonMap, Schema, Token } from '@taquito/michelson-encoder';
import { BigMapResponse, ScriptedContracts } from '@taquito/rpc';
import { isIpfsLink, getFromIpfs } from '@/network/ipfs';
import { isTezosLink, getFromTezos } from '@/network/tezos';
import { TezosRpc } from '@/tezos/provider';
import { toExpr } from '@/tezos/encoders';
import { isJson } from '@/tools/utils';

type TokenMetadataStorage = {
  token_metadata?: string;
  assets?: { token_metadata?: string };
};

type TokenMetadata = {
  token_info?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
  1?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
};

function cleanString(input: string): string {
  // Regular expression to match non-printable characters
  return input.replace(/[\x00-\x1F\x7F]/g, '');
}

function getBigMapToken(contractSchema: Schema, bigMapKey: string): Token | undefined {
  return contractSchema.findToken('big_map').filter((t): boolean => t.annot() === bigMapKey)[0];
}

function getBigMapSchema(contractSchema: Schema, bigMapKey: string): Schema | undefined {
  const token: Token | undefined = getBigMapToken(contractSchema, bigMapKey);
  const michelson: MichelsonExpression | undefined = token?.tokenVal.args?.[1];
  return michelson ? new Schema(michelson) : undefined;
}

async function getBigMapResponse(id: string, bigMapKey: Primitive): Promise<MichelsonExpression | undefined> {
  try {
    const expr: string = toExpr(bigMapKey);
    return TezosRpc()
      .getBigMapExpr(id, expr)
      .catch(() => undefined);
  } catch {
    return undefined;
  }
}

async function getBigMapValue<T>(
  id: string,
  key: Primitive,
  schema?: Schema,
  address?: string
): Promise<T | undefined> {
  const bigMapResponse: BigMapResponse | undefined = await getBigMapResponse(id, key);
  if (bigMapResponse === undefined) return undefined;

  const rawValue: unknown = schema?.Execute(bigMapResponse);
  const final: unknown = decodeMichelsonValue(rawValue, schema);

  if (typeof final === 'string') {
    return resolvePossibleLink<T>(final, address) ?? final;
  }

  return final as T;
}

async function resolvePossibleLink<T = unknown>(value: string, contractAddress?: string): Promise<T> {
  value = cleanString(value);

  if (isIpfsLink(value)) {
    return getFromIpfs<T>(value);
  } else if (isTezosLink(value)) {
    return getFromTezos<T>(value, contractAddress);
  }

  if (isJson(value)) {
    return JSON.parse(value);
  }

  return value as T;
}

/**
 * Retrieves and unwraps the TZIP-17 metadata for a given smart contract.
 *
 * This function fetches the contract's storage, accesses the metadata big map,
 * retrieves multiple standard TZIP-16 metadata fields, and, if the result is a MichelsonMap,
 * applies the schema and unwraps the map into a strongly-typed TZip17Metadata object.
 *
 * @param address - The contract abstraction instance to fetch metadata from.
 * @returns A promise that resolves to the unwrapped TZip17Metadata object if available, or `undefined` otherwise.
 */
export async function getMetadata(address: string): Promise<TZip17Metadata | undefined> {
  const script: ScriptedContracts = await TezosRpc().getScript(address);
  const contractSchema: Schema = Schema.fromRPCResponse({ script });
  const storageResponse: { metadata?: string } = contractSchema.Execute(script.storage);

  const bigMapId: string | undefined = storageResponse.metadata;
  if (!bigMapId) return undefined;

  const metadataSchema: Schema | undefined = getBigMapSchema(contractSchema, 'metadata');
  const final: TZip17Metadata | undefined = await getBigMapValue<TZip17Metadata>(bigMapId, '', metadataSchema, address);
  if (final) return final;

  const [name, description, version] = await Promise.all([
    getBigMapValue<string>(bigMapId, 'name', metadataSchema),
    getBigMapValue<string>(bigMapId, 'description', metadataSchema),
    getBigMapValue<string>(bigMapId, 'version', metadataSchema),
  ]);

  return { name, description, version } as TZip17Metadata;
}

/**
 * Retrieves the metadata for a specific token from a smart contract.
 *
 * This function attempts to access the `token_metadata` big map from the contract's storage,
 * falling back to `assets.token_metadata` if necessary. It then fetches the metadata for the
 * specified `tokenId`, unwraps the Michelson map if present, and returns the token metadata
 * in the TZip21 format.
 *
 * @param address - The contract abstraction instance to query.
 * @param tokenId - The ID of the token whose metadata is to be retrieved. Defaults to 0.
 * @returns A promise that resolves to the token metadata in TZip21 format, or `undefined` if not found.
 */
export async function getTokenMetadata(address: string, tokenId: number = 0): Promise<TZip21TokenMetadata | undefined> {
  const script: ScriptedContracts = await TezosRpc().getScript(address);
  const contractSchema: Schema = Schema.fromRPCResponse({ script });
  const storageResponse: TokenMetadataStorage = contractSchema.Execute(script.storage);

  const bigMapId: string | undefined = storageResponse.token_metadata ?? storageResponse.assets?.token_metadata;
  if (!bigMapId) return undefined;

  const tokenMetadataSchema: Schema | undefined = getBigMapSchema(contractSchema, 'token_metadata');
  const final: TokenMetadata | undefined = await getBigMapValue<TokenMetadata>(
    bigMapId,
    tokenId,
    tokenMetadataSchema,
    address
  );

  const tokenInfo: MichelsonMap<string, unknown> | TZip21TokenMetadata | undefined =
    final?.['token_info'] ?? final?.['1'];

  if (MichelsonMap.isMichelsonMap(tokenInfo)) {
    return unwrapMichelsonMap<TZip21TokenMetadata>(tokenInfo);
  }

  return tokenInfo;
}
