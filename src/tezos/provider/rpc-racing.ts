import { TezosToolkit } from '@taquito/taquito';
import RPC_URLS from '@public/constants/rpc-providers.json';

/**
 * Creates multiple Tezos instances for racing RPC calls
 * @param count Number of instances to create
 * @returns Array of TezosToolkit instances
 */
export function getTezosInstances(count: number = 2): TezosToolkit[] {
  const instances: TezosToolkit[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < Math.min(count, RPC_URLS.length); i++) {
    let randomIndex: number;
    do {
      randomIndex = Math.floor(Math.random() * RPC_URLS.length);
    } while (usedIndices.has(randomIndex));

    usedIndices.add(randomIndex);
    const instance = new TezosToolkit(RPC_URLS[randomIndex]!);
    instances.push(instance);
  }

  return instances;
}

/**
 * Races multiple RPC calls and returns the first successful result
 * @param rpcCall Function that makes the RPC call
 * @param allowUndefined Whether to allow undefined results
 * @returns Promise resolving to the first successful result
 */
export async function raceRpcCalls<T>(
  rpcCall: (tezos: TezosToolkit) => Promise<T>,
  allowUndefined: boolean = false
): Promise<T> {
  const instances = getTezosInstances(2);

  const promises = instances.map(async (instance) => {
    const res = await rpcCall(instance);
    if (!allowUndefined && (res === undefined || res === null)) {
      throw new Error('Undefined result');
    }
    return res;
  });

  try {
    return await Promise.any(promises);
  } catch (e: unknown) {
    if (isAggregateError(e) && Array.isArray(e.errors) && e.errors.length) {
      throw e.errors[0];
    }
    throw new Error('All RPC calls failed');
  }
}

function isAggregateError(e: unknown): e is AggregateError {
  return typeof AggregateError !== 'undefined' && e instanceof AggregateError;
}
