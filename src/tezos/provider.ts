import { MichelCodecPacker, TezosToolkit, Signer } from '@taquito/taquito';
import { RpcClientCache, RpcClient, RpcClientInterface } from '@taquito/rpc';
import { LocalForger } from '@taquito/local-forging';

import { signature, publicKey } from '@public/constants/stub-keys.json';
import RPC_URLS from '@public/constants/rpc-providers.json';

/**
 * A mock implementation of the `Signer` interface for estimating operation fees.
 *
 * The `FakeSigner` class simulates signing operations without performing any real cryptographic actions.
 * It returns placeholder values for signature-related methods and exposes the provided address as the public key hash.
 *
 * @example
 * ```typescript
 * const signer = new FakeSigner('tz1...');
 * const signature = await signer.sign('operation');
 * ```
 */
export class FakeSigner implements Signer {
  constructor(private address: string) {}
  public sign = async (sbytes: string) => ({ bytes: '', sig: '', prefixSig: signature, sbytes });
  public secretKey = async () => undefined;
  public publicKey = async () => publicKey;
  public publicKeyHash = async () => this.address;
}

const TaquitoInstances: TezosToolkit[] = RPC_URLS.map((rpc: string) => {
  const rpcClient: RpcClient = new RpcClient(rpc);
  const rpcClientCache: RpcClientCache = new RpcClientCache(rpcClient);
  const toolkit: TezosToolkit = new TezosToolkit(rpcClientCache);
  toolkit.setPackerProvider(new MichelCodecPacker());
  toolkit.setForgerProvider(new LocalForger());
  return toolkit;
});

// Return a random instance of TezosToolkit to load balance across multiple RPC nodes
/**
 * Returns a randomly selected instance of `TezosToolkit` from the available `TaquitoInstances`.
 *
 * @returns {TezosToolkit} A randomly chosen TezosToolkit instance.
 */
export default function Tezos(): TezosToolkit {
  const randomIndex: number = Math.floor(Math.random() * TaquitoInstances.length);
  return TaquitoInstances[randomIndex]!;
}

export function TezosRpc(): RpcClientInterface {
  const rpcProvider: RpcClientInterface = Tezos().rpc;
  return rpcProvider;
}
