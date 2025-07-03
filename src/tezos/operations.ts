import { Estimate, ParamsWithKind, PreparedOperation, withKind } from '@taquito/taquito';
import { OperationHash, OpKind } from '@taquito/rpc';
import { LocalForger } from '@taquito/local-forging';
import { blake2b } from '@noble/hashes/blake2';

import { prepareBatch } from '@/tezos/taquito-mirror/prepare';
import { estimateBatch } from '@/tezos/taquito-mirror/estimate';
import { TezosRpc } from '@/tezos/provider';
import { assert } from '@/tools/utils';

export function createTransaction(
  source: string,
  to: string,
  amount: number
): withKind<ParamsWithKind, OpKind.TRANSACTION> {
  return { kind: OpKind.TRANSACTION, source, to, amount };
}

/**
 * Applies gas, storage, and fee estimates to a batch of Tezos operation parameters.
 *
 * @param source - The source address or key used to sign the transactions.
 * @param partialParams - An array of operation parameters with operation kind.
 * @returns A promise that resolves to an array of `OperationContents` with estimated gas, storage, and fee values applied.
 *
 * @remarks
 * This function prepares a batch operation, estimates the required resources for each transaction,
 * and updates the transaction contents with the corresponding estimates.
 */
export async function prepare(batchParams: ParamsWithKind[], publicKey?: string): Promise<PreparedOperation> {
  const address: string | undefined = batchParams
    .map((p) => ('pkh' in p ? p.pkh : 'source' in p ? p.source : undefined))
    .find((x) => x !== undefined);
  assert(address, 'Source address or public key hash is required for batch operation preparation');

  const preparedOperation: PreparedOperation = await prepareBatch(batchParams, publicKey);
  const estimates: Estimate[] = await estimateBatch(preparedOperation);

  for (let i: number = 0; i < preparedOperation.opOb.contents.length; i++) {
    const content = preparedOperation.opOb.contents[i]!;
    const estimate = estimates[i]!;

    if ('fee' in content) content.fee = `${estimate?.suggestedFeeMutez ?? content.fee}`;
    if ('gas_limit' in content) content.gas_limit = `${estimate?.gasLimit ?? content.gas_limit}`;
    if ('storage_limit' in content) content.storage_limit = `${estimate?.storageLimit ?? content.storage_limit}`;
  }

  return preparedOperation;
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
export async function forgeOperation({ opOb }: PreparedOperation): Promise<[string, string]> {
  // const branch: string = await TezosRpc().getBlockHash({ block: 'head~2' });
  const opBytes: string = await Forger.forge(opOb);

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
 * @returns A promise that resolves to the operation hash (`OperationHash`) of the injected operation.
 */
export async function sendForgedOperation(forgedHex: string, signatureHex: string): Promise<OperationHash> {
  const completeOperation: string = forgedHex + signatureHex;
  return TezosRpc().injectOperation(completeOperation);
}
