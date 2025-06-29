import { Estimate, ParamsWithKind } from '@taquito/taquito';
import { OperationContents, OperationHash, OpKind } from '@taquito/rpc';
import { LocalForger } from '@taquito/local-forging';
import { blake2b } from '@noble/hashes/blake2';

import Tezos, { TezosRpc } from '@/tezos/provider';
import { assert } from '@/tools/utils';

function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
  return arr1.map((item, index) => [item, arr2[index]] as [T, U]);
}

/**
 * Applies gas, storage, and fee estimates to a batch of Tezos transaction parameters.
 *
 * @param source - The source address or key used to sign the transactions.
 * @param partialParams - An array of transaction parameters with operation kind.
 * @returns A promise that resolves to an array of `OperationContents` with estimated gas, storage, and fee values applied.
 *
 * @throws Will throw an error if any operation kind is not `TRANSACTION`.
 *
 * @remarks
 * This function prepares a batch operation, estimates the required resources for each transaction,
 * and updates the transaction contents with the corresponding estimates.
 */
export async function applyEstimates(source: string, partialParams: ParamsWithKind[]): Promise<OperationContents[]> {
  const estimates: Estimate[] = await Tezos(source).estimate.batch(partialParams);

  const counterString: string = (await TezosRpc().getContract(source)).counter!;
  let _counter: number = parseInt(counterString, 10);

  return zip(partialParams, estimates).map(([param, estimate]): OperationContents => {
    assert(param.kind === OpKind.TRANSACTION, `Unsupported operation kind: ${param.kind}`);

    const { kind, amount: _amount, to: destination } = param;
    const [amount, counter] = [`${_amount * 1e6}`, `${++_counter}`];

    const { gasLimit, storageLimit, suggestedFeeMutez } = estimate;
    const [gas_limit, storage_limit, fee] = [`${gasLimit}`, `${storageLimit}`, `${suggestedFeeMutez}`];

    return { kind, source, destination, amount, gas_limit, storage_limit, fee, counter };
  });
}

/**
 * Forges a Tezos operation and computes its hash.
 *
 * @param contents - An array of operation contents to be forged.
 * @returns A promise that resolves to a tuple containing:
 *   - The forged operation bytes as a hex string.
 *   - The Blake2b hash of the forged operation bytes as a hex string.
 *
 * @remarks
 * This function retrieves the current block hash, forges the operation using the provided contents,
 * and computes the Blake2b hash of the forged bytes (prefixed with '03'). The hash can be used for signing.
 */
const Forger: LocalForger = new LocalForger();
export async function forgeOperation(contents: OperationContents[]): Promise<[string, string]> {
  const branch: string = await TezosRpc().getBlockHash();
  const opBytes: string = await Forger.forge({ contents, branch });

  // Ask the sender to sign this hash
  const payload: Uint8Array = Buffer.from('03' + opBytes, 'hex');
  const bytesHash: Uint8Array = blake2b(payload, { dkLen: 32 });
  const hexHash: string = Buffer.from(bytesHash).toString('hex');

  return [opBytes, hexHash];
}

/**
 * Sends a forged transaction to the Tezos blockchain by combining the forged operation bytes
 * with the signature bytes and injecting the complete operation.
 *
 * @param forgedHex - The hex string representing the forged operation bytes.
 * @param signatureHex - The hex string representing the signature bytes for the operation.
 * @returns A promise that resolves to the operation hash (`OperationHash`) of the injected transaction.
 */
export async function sendForgedTransaction(forgedHex: string, signatureHex: string): Promise<OperationHash> {
  const completeOperation: string = forgedHex + signatureHex;
  return TezosRpc().injectOperation(completeOperation);
}
