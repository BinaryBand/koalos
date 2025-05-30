import { BigMapAbstraction, ContractAbstraction, ContractProvider, TezosToolkit } from '@taquito/taquito';
import { RpcClient, RpcClientCache, ScriptedContracts } from '@taquito/rpc';
import { MichelsonMap, Schema } from '@taquito/michelson-encoder';
import { unwrapMichelsonMap } from '../metadata.js';
import { assert } from '../misc.js';

const RPC_URLS: string[] = [
  'https://mainnet.tezos.ecadinfra.com/',
  'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
];

const rpc: string = RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];
const rpcClient: RpcClient = new RpcClient(rpc);
const rpcClientCache: RpcClientCache = new RpcClientCache(rpcClient);
const Tezos: TezosToolkit = new TezosToolkit(rpcClientCache);

const TEZOS_REGEX: RegExp = /^tezos-storage:(?:\/\/(KT[1-9A-HJ-NP-Za-km-z]+)\/?)?((?:[0-9A-Za-z\-;?:@=&]|(?:%2))+)?$/;

export function isTezosLink(uri: string): boolean {
  return TEZOS_REGEX.test(uri);
}

// https://tzip.tezosagora.org/proposal/tzip-16/#the-tezos-storage-uri-scheme
// TODO: Handle paths with multiple segments, e.g. "tezos-storage://tz1.../entrypoint/segment"
export async function getFromTezos<T = unknown>(uri: string, defaultAddress?: string): Promise<T> {
  const [match, address, path] = TEZOS_REGEX.exec(uri) ?? [];
  assert(match !== undefined, `Invalid Tezos link: ${uri}`);

  const contract: ContractAbstraction<ContractProvider> = await Tezos.contract.at(address ?? defaultAddress);
  const storage: unknown = await contract.storage();

  let rawData: unknown = storage;
  let schema: MichelsonExpression = contract.schema.val;

  // If storage does not have "metadata", return it as is
  if (!rawData || typeof rawData !== 'object' || !('metadata' in rawData)) {
    return rawData as T;
  }

  rawData = rawData['metadata'];

  // Update schema root to the 'metadata' schema if it exists
  if (rawData && typeof rawData === 'object' && 'schema' in rawData) {
    schema = (rawData.schema as Schema).val as MichelsonExpression;
  }

  const segments: string[] = path ? path.split('%2') : [];
  const entrypoint: string | undefined = segments.pop();

  // If the entrypoint is specified, get the value for that entrypoint
  if (rawData instanceof BigMapAbstraction) {
    const michelsonMap = await rawData.getMultipleValues([entrypoint ?? '']);
    schema && michelsonMap.setType(schema);
    rawData = (await unwrapMichelsonMap(michelsonMap))[entrypoint ?? ''];
  }

  // Transform MichelsonMap to a regular JavaScript object
  if (MichelsonMap.isMichelsonMap(rawData)) {
    schema && rawData!.setType(schema);
    rawData = await unwrapMichelsonMap(rawData);
  }

  return rawData as T;
}
