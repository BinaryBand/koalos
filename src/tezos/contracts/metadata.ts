import { MichelsonMap } from '@taquito/taquito';
import { assert, isJson } from '@/tools/utils';

import { BigMap, TezosStorage } from '@/tezos/contracts/storage';
import RpcProvider from '@/tezos/provider';

import { tezosStorageUri } from '@public/constants/regex.json';

const TEZOS_STORAGE_REGEX: RegExp = new RegExp(tezosStorageUri);

export function isTezosLink(uri: string): boolean {
  return TEZOS_STORAGE_REGEX.test(uri);
}

export function normalizeTezosUri(uri: string, defaultAddress?: string): string {
  const match: RegExpExecArray | null = TEZOS_STORAGE_REGEX.exec(uri);
  assert(match, `Invalid Tezos storage URI: ${uri}`);

  const [, address, path] = match;
  const contractAddress: string | undefined = address || defaultAddress;
  assert(contractAddress !== undefined, `No contract address found in URI or default: ${uri}`);

  let normalizedUri: string = `tezos-storage://${contractAddress}`;
  if (path) {
    normalizedUri += `/${path}`;
  }

  return normalizedUri;
}

export async function getMetadataStorage<T>(uri: string): Promise<T | undefined> {
  const match: RegExpExecArray | null = TEZOS_STORAGE_REGEX.exec(uri);
  assert(match, `Invalid Tezos storage URI: ${uri}`);

  const [, address, path] = match;
  assert(address !== undefined, `No contract address found in URI or default: ${uri}`);

  const schema: ContractResponse | undefined = await RpcProvider.singleton.getContractResponse(address);
  const storage: TezosStorage | undefined = new TezosStorage(schema!.script);
  const bigMap: BigMap | undefined = storage?.get<BigMap>('metadata');

  let curr: unknown = bigMap;
  const segments: string[] = path ? path.split('%2F') : [];
  for (const segment of segments) {
    if (curr instanceof TezosStorage || curr instanceof BigMap) {
      curr = await curr.get(segment);
    } else if (MichelsonMap.isMichelsonMap(curr)) {
      curr = curr.get(segment);
    } else if (curr !== null && typeof curr === 'object' && segment in curr) {
      curr = (curr as { [key: string]: unknown })[segment];
    } else {
      throw new Error(`Invalid path segment '${segment}' in Tezos storage URI`);
    }
  }

  if (typeof curr === 'string' && isJson(curr)) {
    return JSON.parse(curr as string) as T;
  }

  return curr as T;
}
