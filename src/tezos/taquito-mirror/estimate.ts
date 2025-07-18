import { Estimate, EstimateProperties, hasMetadataWithResult, isOpWithFee, isOpWithGasBuffer } from '@taquito/taquito';
import { OperationContentsAndResult, PreapplyResponse, RPCSimulateOperationParam } from '@taquito/rpc';
import { ForgeParams, LocalForger } from '@taquito/local-forging';
import { MergedOperationResult } from '@taquito/taquito/dist/types/operations/errors';

import { Blockchain } from '@/tezos/provider';

type Content = PreapplyResponse['contents'][0];

const OP_SIZE_REVEAL: number = 324; // injecting size tz1=320, tz2=322, tz3=322, tz4=420(not supported)
const MILLIGAS_BUFFER: number = 100000;
const STORAGE_BUFFER: number = 20;

function flattenOperationResult(results: PreapplyResponse[]): MergedOperationResult[] {
  const returnedResults: MergedOperationResult[] = [];

  const contents: OperationContentsAndResult[] = results.map((r: PreapplyResponse) => r.contents).flat();
  for (const content of contents.filter((c) => hasMetadataWithResult(c) && 'fee' in c)) {
    returnedResults.push({ fee: content.fee, ...content.metadata.operation_result });

    if (Array.isArray(content.metadata.internal_operation_results)) {
      const internalResults = content.metadata.internal_operation_results.map(({ result }) => result);
      returnedResults.push(...internalResults);
    }
  }

  return returnedResults;
}

function getEstimationContent(content: Content, opSize: number, byteCost: number, orSize: number): EstimateProperties {
  const estimate: EstimateProperties = {
    milligasLimit: 0,
    storageLimit: 0,
    opSize,
    minimalFeePerStorageByteMutez: byteCost,
  };

  for (const res of flattenOperationResult([{ contents: [content] }])) {
    estimate.milligasLimit += Number(res.consumed_milligas) || 0;

    estimate.storageLimit += 'allocated_destination_contract' in res ? orSize : 0; // transfer to unrevealed implicit
    estimate.storageLimit += Array.isArray(res.originated_contracts) ? res.originated_contracts.length * orSize : 0; // originate
    estimate.storageLimit += 'storage_size' in res && 'global_address' in res ? Number(res.storage_size) || 0 : 0; // register_global_constants
    estimate.storageLimit += 'paid_storage_size_diff' in res ? Number(res.paid_storage_size_diff) || 0 : 0; // transfer_ticket, originate, contract_call
    estimate.storageLimit += 'genesis_commitment_hash' in res ? Number(res.size) || 0 : 0; // smart_rollup_originate
  }

  if (!isOpWithFee(content)) {
    return { ...estimate, baseFeeMutez: 0 };
  }

  if (isOpWithGasBuffer(content) || (content.kind === 'transaction' && content.parameters)) {
    estimate.milligasLimit += MILLIGAS_BUFFER;
  }

  if (estimate.storageLimit > 0) {
    estimate.storageLimit += STORAGE_BUFFER;
  }

  return estimate;
}

async function calculateEstimates(op: PreparedOperation) {
  const params: ForgeParams = { branch: op.opOb.branch, contents: op.opOb.contents };
  const forged: string = await new LocalForger().forge(params);

  const operation: RPCSimulateOperationParam = { operation: params, chain_id: await Blockchain.chainId };
  const results: PreapplyResponse = await Blockchain.simulateOperation(operation);

  const nonRevealOps: OperationContentsAndResult[] = results.contents.filter(({ kind }) => kind !== 'reveal');
  const numberOfOps: number = nonRevealOps.length;

  const { cost_per_byte, origination_size = 257 } = await Blockchain.constants;
  return results.contents.map((contents: OperationContentsAndResult) => {
    // Difference between estimated and final OP_SIZE is 124-126, we added buffer to use 130
    let size = (forged.length + 130) / (2 * numberOfOps);
    if (contents.kind === 'reveal') {
      size = OP_SIZE_REVEAL / 2;
    }

    return getEstimationContent(contents, size, cost_per_byte.toNumber(), origination_size);
  });
}

export async function estimateBatch(preparedOperation: PreparedOperation): Promise<Estimate[]> {
  const estimateProperties: EstimateProperties[] = await calculateEstimates(preparedOperation);
  return Estimate.createArrayEstimateInstancesFromProperties(estimateProperties);
}
