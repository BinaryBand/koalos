import { Estimate, OpKind, ParamsWithKind, PreparedOperation, TezosToolkit } from '@taquito/taquito';
import { OperationContents, OperationHash, OperationObject, PreapplyParams } from '@taquito/rpc';
import { LocalForger } from '@taquito/local-forging';
import { blake2b } from '@noble/hashes/blake2';

import Tezos, { FakeSigner, TezosRpc } from '@/tezos/provider';
import { assert } from '@/tools/utils';

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
  const tezos: TezosToolkit = Tezos();
  tezos.setProvider({ signer: new FakeSigner(source) });

  const batchOp: PreparedOperation = await tezos.prepare.batch(partialParams);
  const appliedParams: PreapplyParams = await tezos.prepare.toPreapply(batchOp);
  const transactions: OperationObject | undefined = appliedParams[0];
  assert(transactions !== undefined, 'No transactions found in the prepared operation');

  const estimates: Estimate[] = await tezos.estimate.batch(partialParams);

  function mapTransactions(content: OperationContents, i: number): OperationContents {
    assert(content.kind === OpKind.TRANSACTION, `Unexpected operation kind: ${content.kind}`);
    const estimate: Estimate | undefined = estimates[i];
    assert(estimate !== undefined, `No estimate found for transaction at index ${i}`);
    content.gas_limit = estimate.gasLimit.toString();
    content.storage_limit = estimate.storageLimit.toString();
    content.fee = estimate.suggestedFeeMutez.toString();
    return content;
  }

  return (transactions.contents ?? []).map(mapTransactions);
}

const Forger: LocalForger = new LocalForger();
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
export async function forgeOperation(contents: OperationContents[]): Promise<[string, string]> {
  const branch: string = await TezosRpc().getBlockHash();
  const forgedBytes: string = await Forger.forge({ contents, branch });

  // Ask the sender to sign this hash
  const payload: Uint8Array = Buffer.from('03' + forgedBytes, 'hex');
  const bytesHash: Uint8Array = blake2b(payload, { dkLen: 32 });
  const hexHash: string = Buffer.from(bytesHash).toString('hex');

  return [forgedBytes, hexHash];
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
