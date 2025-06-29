import {
  Estimate,
  EstimateProperties,
  hasMetadataWithResult,
  isOpWithFee,
  isOpWithGasBuffer,
  ParamsWithKind,
  PreparedOperation,
} from '@taquito/taquito';
import {
  ConstantsResponse,
  OperationContentsAndResult,
  PreapplyResponse,
  RPCSimulateOperationParam,
} from '@taquito/rpc';
import { ForgeParams, LocalForger } from '@taquito/local-forging';
import { MergedOperationResult } from '@taquito/taquito/dist/types/operations/errors';

import Tezos, { TezosRpc } from '@/tezos/provider';

const OP_SIZE_REVEAL: number = 324; // injecting size tz1=320, tz2=322, tz3=322, tz4=420(not supported)
const MILLIGAS_BUFFER: number = 100000; // 100 buffer depends on operation kind
const STORAGE_BUFFER: number = 20;

function flattenOperationResult(results: PreapplyResponse[]): MergedOperationResult[] {
  const returnedResults: MergedOperationResult[] = [];
  for (let i = 0; i < results.length; i++) {
    for (let j = 0; j < results[i]!.contents.length; j++) {
      const content = results[i]!.contents[j]!;
      if (hasMetadataWithResult(content) && 'fee' in content) {
        returnedResults.push({
          fee: content.fee,
          ...content.metadata.operation_result,
        });

        if (Array.isArray(content.metadata.internal_operation_results)) {
          content.metadata.internal_operation_results.forEach((x) => returnedResults.push(x.result));
        }
      }
    }
  }

  return returnedResults;
}

export function getEstimationPropertiesFromOperationContent(
  content: PreapplyResponse['contents'][0],
  opSize: number,
  costPerByte: number,
  originationSize: number
): EstimateProperties {
  const operationResults = flattenOperationResult([{ contents: [content] }]);

  let consumedMilligas: number = 0;
  let accumulatedStorage: number = 0;

  operationResults.forEach((result) => {
    consumedMilligas += Number(result.consumed_milligas) || 0;

    // transfer to unrevealed implicit
    accumulatedStorage += 'allocated_destination_contract' in result ? originationSize : 0;

    // originate
    accumulatedStorage +=
      'originated_contracts' in result && Array.isArray(result.originated_contracts)
        ? result.originated_contracts.length * originationSize
        : 0;

    // register_global_constants
    accumulatedStorage += 'storage_size' in result && 'global_address' in result ? Number(result.storage_size) || 0 : 0;

    // transfer_ticket, originate, contract_call
    accumulatedStorage += 'paid_storage_size_diff' in result ? Number(result.paid_storage_size_diff) || 0 : 0;

    //smart_rollup_originate
    accumulatedStorage += 'genesis_commitment_hash' in result ? Number(result.size) || 0 : 0;
  });

  const estimate: EstimateProperties = {
    milligasLimit: 0,
    storageLimit: 0,
    opSize,
    minimalFeePerStorageByteMutez: costPerByte,
  };

  if (isOpWithFee(content)) {
    estimate.milligasLimit = consumedMilligas;
    estimate.storageLimit = accumulatedStorage;
    estimate.minimalFeePerStorageByteMutez = costPerByte;

    if (isOpWithGasBuffer(content) || (content.kind === 'transaction' && content.parameters)) {
      estimate.milligasLimit += MILLIGAS_BUFFER;
    }

    if (estimate.storageLimit > 0) {
      estimate.storageLimit += STORAGE_BUFFER;
    }
  } else {
    estimate.baseFeeMutez = 0;
  }

  return estimate;
}

export async function calculateEstimates(op: PreparedOperation, constants: ConstantsResponse) {
  const params: ForgeParams = Tezos().prepare.toForge(op);
  const opBytes: string = await new LocalForger().forge(params);

  const operation: RPCSimulateOperationParam = {
    operation: params,
    chain_id: await TezosRpc().getChainId(),
  };

  const { contents } = await TezosRpc().simulateOperation(operation);
  const { cost_per_byte, origination_size = 257 } = constants;

  let numberOfOps: number = 1;
  if (Array.isArray(op.opOb.contents) && op.opOb.contents.length > 1) {
    numberOfOps = contents[0]!.kind === 'reveal' ? op.opOb.contents.length - 1 : op.opOb.contents.length;
  }

  return contents.map((contents: OperationContentsAndResult) => {
    // diff between estimated and injecting OP_SIZE is 124-126, we added buffer to use 130
    const size: number = contents.kind === 'reveal' ? OP_SIZE_REVEAL / 2 : (opBytes.length + 130) / 2 / numberOfOps;

    return getEstimationPropertiesFromOperationContent(contents, size, cost_per_byte.toNumber(), origination_size);
  });
}

export async function estimateBatch(params: ParamsWithKind[]) {
  let pkh: string = undefined!;
  params.forEach((param) => {
    if ('source' in param) {
      pkh = param.source;
    }
  });

  const protocolConstants: ConstantsResponse = await TezosRpc().getConstants();
  const preparedOperation: PreparedOperation = await Tezos(pkh).prepare.batch(params);
  const estimateProperties: EstimateProperties[] = await calculateEstimates(preparedOperation, protocolConstants);
  return Estimate.createArrayEstimateInstancesFromProperties(estimateProperties);
}
