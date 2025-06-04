import { Estimate, ForgeParams, OpKind, ParamsWithKind, PreparedOperation, TezosToolkit } from '@taquito/taquito';
import { InMemorySigner } from '@taquito/signer';
import {
  OperationContentsAndResult,
  OperationContentsAndResultTransaction,
  PreapplyParams,
  PreapplyResponse,
  RPCRunOperationParam,
} from '@taquito/rpc';
import { LocalForger } from '@taquito/local-forging';
import { b58cdecode, prefix } from '@taquito/utils';
const Forger: LocalForger = new LocalForger();

import { getTezosToUsdt } from '../tools/explorers/defi/quipuswap.js';
import { addressToDomain } from '../tools/explorers/defi/domains.js';
import Tezos from '../network/taquito.js';
import { assert } from './misc.js';

const MINIMAL_FEE_MUTEZ: number = 100;
const MINIMAL_FEE_PER_GAS_MUTEZ: number = 0.1;

// Metadata on Tezos
export async function getOmniWallet(): Promise<OmniWallet> {
  const price: number = await getTezosToUsdt();
  return { price };
}

export async function getMetaWallet(address: string): Promise<MetaWallet> {
  const [balance, domain] = await Promise.all([Tezos().rpc.getBalance(address), addressToDomain(address)]);

  return {
    address,
    balance: balance.toNumber() / 1e6, // Convert from mutez to tez
    domain,
  };
}

function prepareTransfers(source: string, recipients: TezosRecipient[]): ParamsWithKind[] {
  return recipients.map(({ to, amount }) => ({
    kind: OpKind.TRANSACTION,
    to,
    amount: amount.toNumber(),
    source,
  }));
}

// ipfs://QmQXyEnXmKid7EDzFzAfRjkzDQUp3K5xeSVFCU7X1VZMbH/#transaction-cost
export async function sendTezos(source: string, recipients: TezosRecipient[]): Promise<any> {
  const tezos: TezosToolkit = Tezos();

  const partialParams: ParamsWithKind[] = prepareTransfers(source, recipients);
  const batchOp: PreparedOperation = await tezos.prepare.batch(partialParams);

  const appliedParams: PreapplyParams = await tezos.prepare.toPreapply(batchOp);
  appliedParams[0].protocol = undefined;

  /******************************
   * Sign operation
   * DO NOT USE IN PRODUCTION!
   ******************************/
  // const signer: InMemorySigner = new InMemorySigner(process.env['SECRET_KEY']!);
  const forgedParams: ForgeParams = tezos.prepare.toForge(batchOp);
  const forgedBytes: string = await Forger.forge(forgedParams);
  // const operationSignature: OperationSignature = await signer.sign(forgedBytes, new Uint8Array([3]));
  // const signature: string = operationSignature.prefixSig;
  // appliedParams[0].signature = signature;
  /******************************
   * End of signing operation
   ******************************/

  const { cost_per_byte, origination_size } = await tezos.rpc.getConstants();
  const [costPerByte, originationSize] = [cost_per_byte.toNumber(), origination_size ?? 0];
  const { chain_id } = await tezos.rpc.getBlockHeader();

  const rpcRunOperationParam: RPCRunOperationParam = {
    operation: appliedParams[0],
    chain_id,
  };

  let operationFee: number = 0;
  let burnFee: number = 0;

  const appliedResponse: PreapplyResponse = await tezos.rpc.runOperation(rpcRunOperationParam);
  appliedResponse.contents = appliedResponse.contents.map((content: OperationContentsAndResult) => {
    assert(content.kind === OpKind.TRANSACTION, `Unexpected operation kind: ${content.kind}`);

    const gasLimit: number = parseInt(content.metadata.operation_result.consumed_milligas ?? '0', 10);
    let storageLimit: number = parseInt(content.metadata.operation_result.storage_size ?? '0', 10);
    storageLimit += content.metadata.operation_result.allocated_destination_contract ? originationSize : 0;

    operationFee += Math.ceil(MINIMAL_FEE_PER_GAS_MUTEZ * gasLimit);
    burnFee += Math.ceil(storageLimit * costPerByte);

    content.gas_limit = gasLimit.toString();
    content.storage_limit = storageLimit.toString();

    return content;
  });

  const opSize: number = Buffer.from(forgedBytes, 'hex').length;
  operationFee += Math.ceil(costPerByte * opSize);

  const minimalFee: number = operationFee + MINIMAL_FEE_MUTEZ;
  const totalCost: number = minimalFee + burnFee;

  console.log(`Estimated operation fee: ${operationFee} mutez`);
  console.log(`Estimated minimal fee: ${minimalFee} mutez`);
  console.log(`Estimated burn fee: ${burnFee} mutez`);
  console.log(`Estimated total cost: ${totalCost} mutez`);

  // const forgedParams2: ForgeParams = tezos.prepare.toForge(batchOp);
  // const forgedBytes2: string = await Forger.forge(forgedParams);
}
