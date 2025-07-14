import { Estimate, ParamsWithKindExtended, withKind } from '@taquito/taquito';
import { OperationContents, OpKind, PreapplyResponse, RPCOptions } from '@taquito/rpc';
import { LocalForger } from '@taquito/local-forging';

import { blake2b } from '@noble/hashes/blake2';

import { prepareBatch } from '@/tezos/taquito-mirror/prepare';
import { estimateBatch } from '@/tezos/taquito-mirror/estimate';
import { BlockchainInstance } from '@/tezos/provider';

export type Reveal = withKind<ParamsWithKindExtended, OpKind.REVEAL> & { source: string; public_key: string };
export type Transaction = withKind<ParamsWithKindExtended, OpKind.TRANSACTION>;
export type Origination = withKind<ParamsWithKindExtended, OpKind.ORIGINATION>;
export type Operation = Reveal | Transaction | Origination;

export { checkRevealed } from '@/tezos/taquito-mirror/prepare';

const Blockchain: BlockchainInstance = new BlockchainInstance();

const FORGER: LocalForger = new LocalForger();

/**
 * Creates a Tezos reveal operation object.
 *
 * @param source - The address of the account revealing its public key.
 * @param public_key - The public key to be revealed.
 * @returns A `Reveal` operation object with the specified source and public key.
 */
export function createReveal(source: string, public_key: string): Reveal {
  return { kind: OpKind.REVEAL, source, public_key };
}

/**
 * Creates a Tezos transaction operation object.
 *
 * @param source - The address initiating the transaction.
 * @param to - The recipient address of the transaction.
 * @param amount - The amount to transfer in the transaction.
 * @param parameter - (Optional) Additional parameters for the transaction operation.
 * @returns A `Transaction` object representing the transaction operation.
 */
export function createTransaction(
  source: string,
  to: string,
  amount: number,
  parameter?: TransactionOperationParameter
): Transaction {
  const transaction: Transaction = { kind: OpKind.TRANSACTION, source, to, amount };

  if (parameter !== undefined) {
    transaction.parameter = parameter;
  }

  return transaction;
}

// Create an upload Tezos contract operation
/**
 * Creates an origination operation for a Tezos smart contract.
 *
 * @param code - The Michelson code of the contract as a MichelsonV1Expression.
 * @param storage - The initial storage for the contract as a MichelsonV1Expression.
 * @returns An Origination object representing the origination operation.
 */
export async function createOrigination(
  delegate: string,
  code: MichelsonV1Expression[],
  init: MichelsonV1Expression
): Promise<Origination> {
  return { kind: OpKind.ORIGINATION, delegate, code, init };
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
export async function prepare(batchParams: Operation[], address?: string): Promise<PreparedOperation> {
  const preparedOperation: PreparedOperation = await prepareBatch(batchParams, address);
  const estimates: Estimate[] = await estimateBatch(preparedOperation);

  // Apply estimates to each operation content
  for (let i: number = 0; i < preparedOperation.opOb.contents.length; i++) {
    const content: OperationContents = preparedOperation.opOb.contents[i]!;
    const estimate: Estimate = estimates[i]!;

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
export async function forgeOperation({ opOb }: PreparedOperation): Promise<[string, string]> {
  const opBytes: string = await FORGER.forge(opOb);

  // Ask the sender to sign this hash
  const payload: Uint8Array = Buffer.from('03' + opBytes, 'hex');
  const bytesHash: Uint8Array = blake2b(payload, { dkLen: 32 });
  const hexHash: string = Buffer.from(bytesHash).toString('hex');

  return [opBytes, hexHash];
}

/**
 * Simulates a Tezos blockchain operation without injecting it.
 *
 * @param op - The prepared operation to simulate.
 * @param options - Optional RPC options for the simulation request.
 * @returns A promise that resolves to the preapply response of the simulated operation.
 */
export async function simulateOperation(op: PreparedOperation, options?: RPCOptions): Promise<PreapplyResponse> {
  return Blockchain.simulateOperation(
    {
      operation: { branch: op.opOb.branch, contents: op.opOb.contents },
      chain_id: await Blockchain.getChainId(),
    },
    options
  );
}

/**
 * Sends a forged transaction to the Tezos blockchain by combining the forged operation bytes
 * with the signature bytes and injecting the complete operation.
 *
 * @param forgedHex - The hex string representing the forged operation bytes.
 * @param signatureHex - The hex string representing the signature bytes for the operation.
 * @returns A promise that resolves to the operation hash (`OperationHash`) of the injected operation.
 */
export async function sendForgedOperation(forgedHex: string, signatureHex: string): Promise<string> {
  const signedOperation: string = forgedHex + signatureHex;
  return Blockchain.injectOperation(signedOperation);
}
