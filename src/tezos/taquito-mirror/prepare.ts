import { ManagerKeyResponse, OpKind, OperationContents } from '@taquito/rpc';
import {
  DefaultGlobalConstantsProvider,
  isOpRequireReveal,
  isOpWithFee,
  OriginateParams,
  ParamsWithKindExtended,
  RPCOperation,
  RPCOpWithFee,
  RPCRevealOperation,
} from '@taquito/taquito';
import {
  createRevealOperation,
  createIncreasePaidStorageOperation,
  createOriginationOperation,
  createRegisterGlobalConstantOperation,
  createSetDelegateOperation,
  createSmartRollupAddMessagesOperation,
  createSmartRollupExecuteOutboxMessageOperation,
  createSmartRollupOriginateOperation,
  createTransferOperation,
  createTransferTicketOperation,
} from '@taquito/taquito';
import { Expr, GlobalConstantHashAndValue, Parser, Prim } from '@taquito/michel-codec';
import { Schema, Token } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';

import { BlockchainInstance } from '@/tezos/provider';
import { assert } from '@/tools/utils';

type Limits = {
  fee?: number;
  storageLimit?: number;
  gasLimit?: number;
};

const PARSER: Parser = new Parser();

function mergeLimits(userDefinedLimit: Limits, defaultLimits: Required<Limits>): Required<Limits> {
  return {
    fee: userDefinedLimit.fee ?? defaultLimits.fee,
    gasLimit: userDefinedLimit.gasLimit ?? defaultLimits.gasLimit,
    storageLimit: userDefinedLimit.storageLimit ?? defaultLimits.storageLimit,
  };
}

async function formatCodeParam(code: string | object[]): Promise<Expr[]> {
  if (typeof code !== 'string') {
    const expr: Prim[] = PARSER.parseJSON(code) as Prim[];
    const order: string[] = ['parameter', 'storage', 'code'];
    return expr.sort((a, b) => order.indexOf(a.prim) - order.indexOf(b.prim));
  }

  return PARSER.parseScript(code)!;
}

async function formatInitParam(init: string | object): Promise<Expr> {
  return typeof init === 'string' ? PARSER.parseMichelineExpression(init)! : PARSER.parseJSON(init);
}

async function findGlobalConstantsHashAndValue(schema: Schema): Promise<GlobalConstantHashAndValue> {
  const globalConstantTokens: Token[] = schema.findToken('constant');
  if (globalConstantTokens.length === 0) return {};

  const globalConstantsHashAndValue: GlobalConstantHashAndValue = {};
  for (const expression of globalConstantTokens.map((t: Token) => t.tokenVal.args?.[0])) {
    if (expression && 'string' in expression && expression.string !== undefined) {
      const hash: string = expression.string;
      const michelineValue: Expr = await new DefaultGlobalConstantsProvider().getGlobalConstantByHash(hash);
      Object.assign(globalConstantsHashAndValue, { [hash]: michelineValue });
    }
  }

  return globalConstantsHashAndValue;
}

export async function prepareCodeOrigination(params: OriginateParams): Promise<OriginateParams> {
  params.code = await formatCodeParam(params.code);

  if (params.init) {
    const init: Expr = await formatInitParam(params.init);
    return { ...params, init };
  }

  if (params.storage !== undefined) {
    const storageType: Prim = params.code.find((p): p is Prim => 'prim' in p && p.prim === 'storage')!;
    assert(storageType?.args, 'The storage section is missing from the script');

    const schema: Schema = new Schema(storageType.args[0]!);
    const globalConstantsHashAndValue: GlobalConstantHashAndValue = await findGlobalConstantsHashAndValue(schema);

    if (Object.keys(globalConstantsHashAndValue).length !== 0) {
      const p: Parser = new Parser({ expandGlobalConstant: globalConstantsHashAndValue });
      const storageTypeNoGlobalConst = p.parseJSON(storageType.args[0]!);
      const schemaNoGlobalConst: Schema = new Schema(storageTypeNoGlobalConst);
      params.init = schemaNoGlobalConst.Encode(params.storage);
    } else {
      params.init = schema.Encode(params.storage);
    }

    delete params.storage;
  }

  return params;
}

async function getRpcOp(params: ParamsWithKindExtended): Promise<RPCOperation> {
  switch (params.kind) {
    case OpKind.REVEAL:
      const { source, public_key } = params as RPCRevealOperation;
      return createRevealOperation({ ...params }, source!, public_key!);
    case OpKind.TRANSACTION:
      return createTransferOperation({ ...params });
    case OpKind.ORIGINATION:
      return createOriginationOperation(await prepareCodeOrigination({ ...params }));
    case OpKind.DELEGATION:
      return createSetDelegateOperation({ ...params });
    case OpKind.REGISTER_GLOBAL_CONSTANT:
      return createRegisterGlobalConstantOperation({ ...params });
    case OpKind.INCREASE_PAID_STORAGE:
      return createIncreasePaidStorageOperation({ ...params });
    case OpKind.TRANSFER_TICKET:
      return createTransferTicketOperation({ ...params });
    case OpKind.SMART_ROLLUP_ADD_MESSAGES:
      return createSmartRollupAddMessagesOperation({ ...params });
    case OpKind.SMART_ROLLUP_ORIGINATE:
      return createSmartRollupOriginateOperation({ ...params });
    case OpKind.SMART_ROLLUP_EXECUTE_OUTBOX_MESSAGE:
      return createSmartRollupExecuteOutboxMessageOperation({ ...params });
    default:
      throw new Error(`Invalid operation kind: ${params.kind}`);
  }
}

function constructOpContents(ops: RPCOperation[], headCounter: number, source: string): OperationContents[] {
  const counters: Record<string, number> = {};

  const getFee = (op: RPCOpWithFee, address: string, headCounter: number) => {
    if (!counters[address] || counters[address] < headCounter) {
      counters[address] = headCounter;
    }

    const opCounter: number = ++counters[address];
    return {
      counter: `${opCounter}`,
      fee: `${op.fee ?? 0}`,
      gas_limit: `${op.gas_limit ?? 0}`,
      storage_limit: `${op.storage_limit ?? 0}`,
    };
  };

  return ops.map((op: RPCOperation) => {
    switch (op.kind) {
      case OpKind.ACTIVATION:
      case OpKind.DRAIN_DELEGATE:
        return op;
      case OpKind.ORIGINATION:
        return { ...op, balance: `${op.balance ?? 0}`, source, ...getFee(op, source, headCounter) };
      case OpKind.INCREASE_PAID_STORAGE:
      case OpKind.TRANSACTION:
        return { ...op, amount: `${op.amount ?? 0}`, source, ...getFee(op, source, headCounter) };
      case OpKind.REVEAL:
      case OpKind.DELEGATION:
      case OpKind.REGISTER_GLOBAL_CONSTANT:
      case OpKind.UPDATE_CONSENSUS_KEY:
      case OpKind.SMART_ROLLUP_ADD_MESSAGES:
      case OpKind.SMART_ROLLUP_ORIGINATE:
      case OpKind.SMART_ROLLUP_EXECUTE_OUTBOX_MESSAGE:
        return { ...op, source, ...getFee(op, source, headCounter) };
      case OpKind.TRANSFER_TICKET:
        const ticket_amount: string = `${op.ticket_amount ?? 0}`;
        return { ...op, ticket_amount, source, ...getFee(op, source, headCounter) };
      default:
        throw new Error(`Invalid operation kind: ${op.kind}`);
    }
  });
}

async function applyLimits(batchParams: ParamsWithKindExtended[]): Promise<RPCOperation[]> {
  const blockchainInstance: BlockchainInstance = new BlockchainInstance();

  let defaultLimits: Required<Limits> = undefined!;
  if (batchParams.some(isOpWithFee)) {
    const { hard_gas_limit_per_block, hard_gas_limit_per_operation, hard_storage_limit_per_operation } =
      await blockchainInstance.getConstants();

    const gasLimit: BigNumber = BigNumber.min(
      hard_gas_limit_per_operation,
      hard_gas_limit_per_block.div(batchParams.length + 1)
    );

    defaultLimits = {
      fee: 0,
      gasLimit: Math.floor(gasLimit.toNumber()),
      storageLimit: hard_storage_limit_per_operation.toNumber(),
    };
  }

  return Promise.all(
    batchParams.map((op) => (isOpWithFee(op) ? getRpcOp({ ...op, ...mergeLimits(op, defaultLimits) }) : op)).flat()
  );
}

type AddressCandidates = {
  pkh: string;
  source: string;
  delegate: string;
};

export function extractAddressFromParams(batchParams: ParamsWithKindExtended[]): string | undefined {
  const candidates: AddressCandidates = batchParams.reduce(
    (acc: AddressCandidates, op: ParamsWithKindExtended) => {
      acc.pkh ||= 'pkh' in op ? op.pkh : acc.pkh;
      acc.source ||= 'source' in op ? op.source : acc.source;
      acc.delegate ||= 'delegate' in op ? op.delegate : acc.delegate;
      return acc;
    },
    { pkh: '', source: '', delegate: '' }
  );

  return candidates.pkh || candidates.source || candidates.delegate;
}

export async function checkRevealed(address: string): Promise<boolean> {
  const blockchainInstance: BlockchainInstance = new BlockchainInstance();

  const manager: ManagerKeyResponse | undefined = await blockchainInstance.getManagerKey(address);
  return Boolean(manager) && Boolean(typeof manager === 'object' ? manager.key : manager);
}

export async function needsReveal(batchParams: ParamsWithKindExtended[], address?: string): Promise<boolean> {
  const revealNeeded: boolean = batchParams.some(isOpRequireReveal);
  if (!revealNeeded) return false;

  const hasReveal: boolean = batchParams.some((op) => op.kind === OpKind.REVEAL);
  if (hasReveal) return false;

  address ??= extractAddressFromParams(batchParams)!;
  return !(await checkRevealed(address));
}

export async function prepareBatch(
  batchParams: ParamsWithKindExtended[],
  address?: string
): Promise<PreparedOperation> {
  const blockchainInstance: BlockchainInstance = new BlockchainInstance();

  address ??= extractAddressFromParams(batchParams)!;

  const operations: RPCOperation[] = await applyLimits(batchParams);
  assert(!(await needsReveal(batchParams, address)), 'Reveal operation is needed but not provided in the batch');

  const [branch, { protocol }, contract] = await Promise.all([
    blockchainInstance.getBlockHash({ block: 'head~2' }),
    blockchainInstance.getProtocols(),
    blockchainInstance.getContractResponse(address),
  ]);

  const headCounter: number = parseInt(contract?.counter ?? '0', 10);
  const contents: OperationContents[] = constructOpContents(operations, headCounter, address);

  return { opOb: { branch, contents, protocol }, counter: headCounter };
}
