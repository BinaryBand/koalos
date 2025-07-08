import { OpKind, OperationContents, ManagerKeyResponse } from '@taquito/rpc';
import {
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
import { Schema } from '@taquito/michelson-encoder';
import { BigNumber } from 'bignumber.js';

import { Blockchain } from '@/tezos/provider';
import { assert } from '@/tools/utils';

function mergeLimits(userDefinedLimit: Limits, defaultLimits: Required<Limits>): Required<Limits> {
  return {
    fee: userDefinedLimit.fee ?? defaultLimits.fee,
    gasLimit: userDefinedLimit.gasLimit ?? defaultLimits.gasLimit,
    storageLimit: userDefinedLimit.storageLimit ?? defaultLimits.storageLimit,
  };
}

const P: Parser = new Parser();
async function formatCodeParam(code: string | object[]): Promise<Expr[]> {
  if (typeof code !== 'string') {
    const expr: Prim[] = P.parseJSON(code) as Prim[];
    const order: string[] = ['parameter', 'storage', 'code'];
    return expr.sort((a, b) => order.indexOf(a.prim) - order.indexOf(b.prim));
  }

  return P.parseScript(code)!;
}

async function formatInitParam(init: string | object): Promise<Expr> {
  return typeof init === 'string' ? P.parseMichelineExpression(init)! : P.parseJSON(init);
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
    const schema: Schema = new Schema(storageType.args[0]!);
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

function constructOpContents(
  ops: RPCOperation[],
  headCounter: number,
  source: string,
  counters: Record<string, number> = {}
): OperationContents[] {
  function getFee(op: RPCOpWithFee, address: string, headCounter: number) {
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
  }

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

async function applyLimits(batchParams: ParamsWithKind[]): Promise<RPCOperation[]> {
  let defaultLimits: Required<Limits> = undefined!;
  if (batchParams.some(isOpWithFee)) {
    const { hard_gas_limit_per_block, hard_gas_limit_per_operation, hard_storage_limit_per_operation } =
      await Blockchain.constants;

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
    batchParams
      .map((op) => (isOpWithFee(op) ? getRpcOp({ ...op, ...mergeLimits(op, defaultLimits) }) : Promise.resolve(op)))
      .flat()
  );
}

export function extractAddressFromParams(batchParams: ParamsWithKind[]): string | undefined {
  return batchParams
    .map((p) => ('pkh' in p ? p.pkh : 'source' in p ? p.source : undefined))
    .find((x) => x !== undefined);
}

export async function prepareBatch(batchParams: ParamsWithKind[], publicKey?: string): Promise<PreparedOperation> {
  const address: string | undefined = extractAddressFromParams(batchParams);
  assert(address, 'Source address or public key hash is required for batch operation preparation');

  const operations: RPCOperation[] = await applyLimits(batchParams);

  const managerKeyExists = async () => {
    const manager: ManagerKeyResponse | undefined = await Blockchain.getManagerKey(address);
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
    operations.unshift(revealOp);
  }

  const [branch, { protocol }, contract] = await Promise.all([
    Blockchain.getBlockHash({ block: 'head~2' }),
    Blockchain.getProtocols(),
    Blockchain.getContractResponse(address),
  ]);

  const headCounter: number = parseInt(contract?.counter ?? '0', 10);
  const contents: OperationContents[] = constructOpContents(operations, headCounter, address);

  return { opOb: { branch, contents, protocol }, counter: headCounter };
}
