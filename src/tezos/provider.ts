// import { MichelCodecPacker, TezosToolkit, Signer } from '@taquito/taquito';
import { TezosToolkit, Signer } from '@taquito/taquito';
import { BigMapResponse, RpcClientInterface, ScriptResponse } from '@taquito/rpc';

import { publicKey, signature } from '@public/constants/stub-keys.json';
import RPC_URLS from '@public/constants/rpc-providers.json';
import { toExpr } from '@/tezos/codec';

/**
 * A mock implementation of the `Signer` interface for estimating operation fees.
 *
 * The `FakeSigner` class simulates signing operations without performing any real cryptographic actions.
 * It returns placeholder values for signature-related methods and exposes the provided address as the public key hash.
 */
export class FakeSigner implements Signer {
  constructor(private address: string) {}
  public sign = async (sbytes: string) => ({ bytes: '', sig: '', prefixSig: signature, sbytes });
  public secretKey = async () => undefined;
  public publicKey = async () => publicKey;
  public publicKeyHash = async () => this.address;
}

const TaquitoInstances: TezosToolkit[] = RPC_URLS.map((rpc: string) => new TezosToolkit(rpc));

/**
 * Returns a randomly selected instance of `TezosToolkit` from the available `TaquitoInstances`.
 *
 * @returns {TezosToolkit} A randomly chosen TezosToolkit instance.
 */
export default function Tezos(address?: string): TezosToolkit {
  const randomIndex: number = Math.floor(Math.random() * TaquitoInstances.length);
  const tezos: TezosToolkit = TaquitoInstances[randomIndex]!;

  if (address !== undefined) {
    const fakeSigner: FakeSigner = new FakeSigner(address);
    tezos.setProvider({ signer: fakeSigner });
  }

  return tezos;
}

export const TezosRpc = (): RpcClientInterface => Tezos().rpc;

export async function getScript(address: string, block: string = 'head'): Promise<ScriptResponse | undefined> {
  return TezosRpc()
    .getScript(address, { block })
    .catch(() => undefined);
}

export async function getBigMapValue(
  id: string,
  key: Primitive,
  block: string = 'head'
): Promise<BigMapResponse | undefined> {
  const expr: string = toExpr(key);
  return TezosRpc()
    .getBigMapExpr(id, expr, { block })
    .catch(() => undefined);
}
