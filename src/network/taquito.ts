import 'dotenv/config';

import { BigMapAbstraction, TezosToolkit, Signer } from '@taquito/taquito';
import { MichelsonMap, Schema } from '@taquito/michelson-encoder';
import { RpcClientCache, RpcClient } from '@taquito/rpc';
import { b58cdecode, prefix } from '@taquito/utils';

import { unwrapMichelsonMap } from '../tools/michelson/michelson-map.js';
import { getFromCache, setInCache } from './cache.js';
import { assert } from '../tools/misc.js';

const RPC_URLS: string[] = [
  'https://mainnet.tezos.ecadinfra.com/',
  // 'https://rpc.tzbeta.net/',
  'https://mainnet.smartpy.io/',
  // 'https://rpc.tzkt.io/mainnet/',
];

// stub signature that won't be verified by tezos rpc simulate_operation
const STUB_SIGNATURE: string =
  'edsigtkpiSSschcaCt9pUVrpNPf7TTcgvgDEDD6NCEHMy8NNQJCGnMfLZzYoQj74yLjo9wx6MPVV29CvVzgi7qEcEUok3k7AuMg';
const STUB_BUFFER: Uint8Array = b58cdecode(STUB_SIGNATURE, prefix.edsig);
const STUB_PACKED: string = Buffer.from(STUB_BUFFER).toString('hex');

class Forger implements Signer {
  private _address: string;

  constructor(address: string) {
    this._address = address;
  }

  public sign = async (op: string) => ({
    bytes: op,
    sig: STUB_SIGNATURE,
    prefixSig: STUB_SIGNATURE,
    sbytes: op + STUB_PACKED,
  });

  public secretKey = async () => undefined;
  public publicKey = async () => 'edpkuBknW28nW72KG6RoHtYW7p12T6GKc7nAbwYX5m8Wd9sDVC9yav';
  public publicKeyHash = async () => this._address;
}

const TaquitoInstances: TezosToolkit[] = RPC_URLS.map((rpc: string) => {
  const rpcClient: RpcClient = new RpcClient(rpc);
  const rpcClientCache: RpcClientCache = new RpcClientCache(rpcClient);
  const Tezos: TezosToolkit = new TezosToolkit(rpcClientCache);

  const signer: Signer = new Forger(process.env['ADDRESS']!);
  Tezos.setProvider({ signer });

  return Tezos;
});

export default function Tezos(): TezosToolkit {
  // Return a random instance of TezosToolkit
  const randomIndex: number = Math.floor(Math.random() * TaquitoInstances.length);
  return TaquitoInstances[randomIndex];
}

const TEZOS_REGEX: RegExp = /^tezos-storage:(?:\/\/(KT[1-9A-HJ-NP-Za-km-z]+)\/?)?((?:[0-9A-Za-z\-;?:@=&]|(?:%2))+)?$/;

export function isTezosLink(uri: string): boolean {
  return TEZOS_REGEX.test(uri);
}

// https://tzip.tezosagora.org/proposal/tzip-16/#the-tezos-storage-uri-scheme
// TODO: Handle paths with multiple segments, e.g. "tezos-storage://tz1.../entrypoint/segment"
export async function getFromTezos<T = unknown>(uri: string, defaultAddress?: string): Promise<T> {
  const [match, address, path] = TEZOS_REGEX.exec(uri) ?? [];
  assert(match !== undefined, `Invalid Tezos link: ${uri}`);

  let cachedData: string | null = await getFromCache([address, path].join('/'));
  if (cachedData !== null) {
    return JSON.parse(cachedData) as T;
  }

  const contract: ContractAbstraction = await Tezos().contract.at(address ?? defaultAddress);
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

  // Cache the raw data for future use
  cachedData = JSON.stringify(rawData);
  await setInCache([uri, defaultAddress].join('/'), cachedData, 24 * 60 * 60); // Cache for 24 hours

  return rawData as T;
}
