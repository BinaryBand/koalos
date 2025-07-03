import { OpKind, VotingPeriodBlockResult, OperationContents, ManagerKeyResponse } from '@taquito/rpc';
import {
  createRevealOperation,
  DefaultGlobalConstantsProvider,
  getRevealFee,
  getRevealGasLimit,
  isOpRequireReveal,
  isOpWithFee,
  OriginateParams,
  ParamsWithKind,
  PreparedOperation,
  RevealParams,
  RPCOperation,
  RPCOpWithFee,
  RPCOpWithSource,
  RPCRevealOperation,
} from '@taquito/taquito';
import {
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
import { Schema } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';

import { TezosRpc } from '@/index';
import { assert } from '@/tools/utils';

function mergeLimits(userDefinedLimit: Limits, defaultLimits: Required<Limits>): Required<Limits> {
  return {
    fee: userDefinedLimit.fee ?? defaultLimits.fee,
    gasLimit: userDefinedLimit.gasLimit ?? defaultLimits.gasLimit,
    storageLimit: userDefinedLimit.storageLimit ?? defaultLimits.storageLimit,
  };
}

const p: Parser = new Parser();
async function formatCodeParam(code: string | object[]) {
  let parsedCode: Expr[];
  if (typeof code === 'string') {
    const c = p.parseScript(code);
    if (c === null) {
      throw new Error('Unable to parse code');
    }
    parsedCode = c;
  } else {
    const expr: Expr = p.parseJSON(code);
    const order = ['parameter', 'storage', 'code'];
    parsedCode = (expr as Prim[]).sort((a, b) => order.indexOf(a.prim) - order.indexOf(b.prim));
  }
  return parsedCode;
}

async function formatInitParam(init: string | object) {
  let parsedInit: Expr;
  if (typeof init === 'string') {
    const c = p.parseMichelineExpression(init);
    if (c === null) {
      throw new Error('Invalid init parameter');
    }
    parsedInit = c;
  } else {
    parsedInit = p.parseJSON(init);
  }
  return parsedInit;
}

async function findGlobalConstantsHashAndValue(schema: Schema) {
  const globalConstantTokens = schema.findToken('constant');
  const globalConstantsHashAndValue: GlobalConstantHashAndValue = {};
  if (globalConstantTokens.length !== 0) {
    for (const token of globalConstantTokens) {
      const tokenArgs = token.tokenVal.args;
      if (tokenArgs) {
        const expression = tokenArgs[0] as MichelsonExpressionBase;
        if (expression.string) {
          const hash: string = expression.string;
          const michelineValue = await new DefaultGlobalConstantsProvider().getGlobalConstantByHash(hash);
          Object.assign(globalConstantsHashAndValue, {
            [hash]: michelineValue,
          });
        }
      }
    }
  }
  return globalConstantsHashAndValue;
}

async function prepareCodeOrigination(params: OriginateParams): Promise<OriginateParams> {
  const parsedParams = params;
  parsedParams.code = await formatCodeParam(params.code);
  if (params.init) {
    parsedParams.init = await formatInitParam(params.init);
  } else if (params.storage) {
    const storageType = (parsedParams.code as Expr[]).find((p): p is Prim => 'prim' in p && p.prim === 'storage');
    if (!storageType?.args) {
      throw new Error('The storage section is missing from the script');
    }
    const schema = new Schema(storageType.args[0]!);
    const globalConstantsHashAndValue = await findGlobalConstantsHashAndValue(schema);

    if (Object.keys(globalConstantsHashAndValue).length !== 0) {
      const p = new Parser({ expandGlobalConstant: globalConstantsHashAndValue });
      const storageTypeNoGlobalConst = p.parseJSON(storageType.args[0]!);
      const schemaNoGlobalConst = new Schema(storageTypeNoGlobalConst);
      parsedParams.init = schemaNoGlobalConst.Encode(params.storage);
    } else {
      parsedParams.init = schema.Encode(params.storage);
    }

    delete parsedParams.storage;
  }
  return parsedParams;
}

async function getRpcOp(params: ParamsWithKind): Promise<RPCOperation> {
  switch (params.kind) {
    // case OpKind.REVEAL:
    //   return createRevealOperation({ ...params }, params.source!, params.public_key);
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

function getSource(op: RPCOpWithSource, pkh: string, source: string | undefined) {
  return { source: typeof op.source === 'undefined' ? source || pkh : op.source };
}

function constructOpContents(
  ops: RPCOperation[],
  headCounter: number,
  pkh: string,
  counters: Record<string, number> = {},
  source?: string,
  currentVotingPeriod?: VotingPeriodBlockResult
): OperationContents[] {
  function getFee(op: RPCOpWithFee, pkh: string, headCounter: number) {
    if (!counters[pkh] || counters[pkh] < headCounter) {
      counters[pkh] = headCounter;
    }

    const opCounter: number = ++counters[pkh];
    return {
      counter: `${opCounter}`,
      fee: `${op.fee ?? 0}`,
      gas_limit: `${op.gas_limit ?? 0}`,
      storage_limit: `${op.storage_limit ?? 0}`,
    };
  }

  return ops.map((op: RPCOperation) => {
    switch (op.kind) {
      case OpKind.ACTIVATION:
      case OpKind.DRAIN_DELEGATE:
        return op;
      case OpKind.ORIGINATION:
        return { ...op, balance: `${op.balance ?? 0}`, ...getSource(op, pkh, source), ...getFee(op, pkh, headCounter) };
      case OpKind.INCREASE_PAID_STORAGE:
      case OpKind.TRANSACTION:
        return { ...op, amount: `${op.amount ?? 0}`, ...getSource(op, pkh, source), ...getFee(op, pkh, headCounter) };
      case OpKind.REVEAL:
      case OpKind.DELEGATION:
      case OpKind.REGISTER_GLOBAL_CONSTANT:
      case OpKind.UPDATE_CONSENSUS_KEY:
      case OpKind.SMART_ROLLUP_ADD_MESSAGES:
      case OpKind.SMART_ROLLUP_ORIGINATE:
      case OpKind.SMART_ROLLUP_EXECUTE_OUTBOX_MESSAGE:
        return { ...op, ...getSource(op, pkh, source), ...getFee(op, pkh, headCounter) };
      case OpKind.TRANSFER_TICKET:
        return {
          ...op,
          ticket_amount: `${op.ticket_amount ?? 0}`,
          ...getSource(op, pkh, source),
          ...getFee(op, pkh, headCounter),
        };
      case OpKind.BALLOT:
        assert(currentVotingPeriod, 'Current voting period is required for ballot operation');
        return { ...op, period: currentVotingPeriod?.voting_period.index };
      case OpKind.PROPOSALS:
        assert(currentVotingPeriod, 'Current voting period is required for proposals operation');
        return { ...op, period: currentVotingPeriod?.voting_period.index };
      default:
        throw new Error(`Invalid operation kind: ${op.kind}`);
    }
  });
}

export async function prepareBatch(
  batchParams: ParamsWithKind[],
  publicKey?: string,
  currentVotingPeriod?: VotingPeriodBlockResult
): Promise<PreparedOperation> {
  const { source } = batchParams.find((param): param is ParamsWithKind & { source: string } => 'source' in param) || {};

  const address: string | undefined =
    batchParams.find((param): param is ParamsWithKind & { pkh: string } => 'pkh' in param)?.pkh || source;
  assert(address, 'Source address or public key hash is required for batch operation preparation');

  let defaultLimits: Required<Limits> = undefined!;
  if (batchParams.some(isOpWithFee)) {
    const { hard_gas_limit_per_block, hard_gas_limit_per_operation, hard_storage_limit_per_operation } =
      await TezosRpc().getConstants();

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

  const ops: RPCOperation[] = await Promise.all(
    batchParams
      .map(async (op): Promise<RPCOperation> => {
        if (!isOpWithFee(op)) {
          return op;
        }

        const limits: Required<Limits> = mergeLimits(op, defaultLimits);
        return getRpcOp({ ...op, ...limits });
      })
      .flat()
  );

  const managerKeyExists = async () => {
    const manager: ManagerKeyResponse = await TezosRpc().getManagerKey(address);
    return manager && Boolean(typeof manager === 'object' ? manager.key : manager);
  };

  const revealNeeded: boolean = batchParams.some((op) => isOpRequireReveal(op)) && !(await managerKeyExists());
  if (revealNeeded === true) {
    assert(publicKey, 'Reveal operation is needed but public key is not defined');

    const revealParams: RevealParams = {
      fee: getRevealFee(address),
      storageLimit: 0,
      gasLimit: getRevealGasLimit(address),
    };

    const revealOp: RPCRevealOperation = await createRevealOperation(revealParams, address, publicKey);
    ops.unshift(revealOp);
  }

  const [branch, { protocol }, { counter }] = await Promise.all([
    TezosRpc().getBlockHash({ block: 'head~2' }),
    TezosRpc().getProtocols(),
    TezosRpc().getContract(address),
  ]);

  const counters: Record<string, number> = {};
  const headCounter: number = parseInt(counter!, 10);
  const contents: OperationContents[] = constructOpContents(
    ops,
    headCounter,
    address,
    counters,
    source,
    currentVotingPeriod
  );

  return { opOb: { branch, contents, protocol }, counter: headCounter };
}
