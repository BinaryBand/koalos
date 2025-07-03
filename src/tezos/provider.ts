import { TezosToolkit, Signer } from '@taquito/taquito';
import { BigMapResponse, RpcClientInterface, ScriptResponse } from '@taquito/rpc';

import { publicKey, address as pkh, signature } from '@public/constants/stub-values.json';
import RPC_URLS from '@public/constants/rpc-providers.json';
import { toExpr } from '@/tezos/codec';

const TaquitoInstances: TezosToolkit[] = RPC_URLS.map((rpc: string) => new TezosToolkit(rpc));

/**
 * Returns a randomly selected instance of `TezosToolkit` from the available `TaquitoInstances`.
 *
 * @returns {TezosToolkit} A randomly chosen TezosToolkit instance.
 */
export default function Tezos(address?: string): TezosToolkit {
  const randomIndex: number = Math.floor(Math.random() * TaquitoInstances.length);
  const tezos: TezosToolkit = TaquitoInstances[randomIndex]!;

  const forgerer: Signer = {
    secretKey: undefined!,
    publicKey: async () => publicKey,
    publicKeyHash: async () => address ?? pkh,
    sign: async () => ({ bytes: undefined!, sig: signature, prefixSig: signature, sbytes: undefined! }),
  };

  tezos.setSignerProvider(forgerer);
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
