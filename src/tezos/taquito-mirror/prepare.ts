import { OpKind, ConstantsResponse, ManagerKeyResponse } from '@taquito/rpc';
import {
  DefaultGlobalConstantsProvider,
  getRevealFee,
  getRevealGasLimit,
  isOpWithFee,
  OriginateParams,
  ParamsWithKind,
  PreparedOperation,
  RevealParams,
  RPCOperation,
  RPCOpWithSource,
  RPCRevealOperation,
} from '@taquito/taquito';
import {
  createIncreasePaidStorageOperation,
  createOriginationOperation,
  createRegisterGlobalConstantOperation,
  createRevealOperation,
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

const REVEAL_STORAGE_LIMIT: number = 0;

export function mergeLimits(userDefinedLimit: Limits, defaultLimits: Required<Limits>): Required<Limits> {
  return {
    fee: userDefinedLimit.fee ?? defaultLimits.fee,
    gasLimit: userDefinedLimit.gasLimit ?? defaultLimits.gasLimit,
    storageLimit: userDefinedLimit.storageLimit ?? defaultLimits.storageLimit,
  };
}

export function adjustGasForBatchOperation(gasLimitBlock: BigNumber, gaslimitOp: BigNumber, numberOfOps: number) {
  return BigNumber.min(gaslimitOp, gasLimitBlock.div(numberOfOps + 1));
}

export async function getOperationLimits(
  constants: Pick<
    ConstantsResponse,
    'hard_gas_limit_per_operation' | 'hard_gas_limit_per_block' | 'hard_storage_limit_per_operation'
  >,
  numberOfOps?: number
) {
  const { hard_gas_limit_per_operation, hard_gas_limit_per_block, hard_storage_limit_per_operation } = constants;
  return {
    fee: 0,
    gasLimit: numberOfOps
      ? Math.floor(
          adjustGasForBatchOperation(hard_gas_limit_per_block, hard_gas_limit_per_operation, numberOfOps).toNumber()
        )
      : hard_gas_limit_per_operation.toNumber(),
    storageLimit: hard_storage_limit_per_operation.toNumber(),
  };
}

export function getSource(op: RPCOpWithSource, pkh: string, source?: string) {
  return { source: typeof op.source === 'undefined' ? source || pkh : op.source };
}

const p: Parser = new Parser();
async function formatCodeParam(code: string | object[]) {
  let parsedCode: Expr[];
  if (typeof code === 'string') {
    const c = p.parseScript(code);
    if (c === null) {
      // throw new InvalidCodeParameter('Unable to parse', code);
      throw new Error('Unable to parse code');
    }
    parsedCode = c;
  } else {
    const expr: Expr = p.parseJSON(code);
    const order = ['parameter', 'storage', 'code'];
    // Ensure correct ordering for RPC
    parsedCode = (expr as Prim[]).sort((a, b) => order.indexOf(a.prim) - order.indexOf(b.prim));
  }
  return parsedCode;
}

async function formatInitParam(init: string | object) {
  let parsedInit: Expr;
  if (typeof init === 'string') {
    const c = p.parseMichelineExpression(init);
    if (c === null) {
      // throw new InvalidInitParameter('Invalid init parameter', init);
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
      // throw new InvalidCodeParameter('The storage section is missing from the script', params.code);
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

export async function getRPCOp(params: ParamsWithKind): Promise<RPCOperation> {
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
      // throw new InvalidOperationKindError(JSON.stringify((param as any).kind));
      throw new Error(`Invalid operation kind: ${params.kind}`);
  }
}

export async function prepareBatch(batchParams: ParamsWithKind[], self?: any): Promise<PreparedOperation> {
  let pkh: string = undefined!;
  batchParams.forEach((param) => {
    if ('source' in param) {
      pkh = param.source;
    }
  });

  let publicKey: string | undefined;
  if (pkh) {
    const managerKey: ManagerKeyResponse = await TezosRpc().getManagerKey(pkh);
    publicKey = typeof managerKey === 'string' ? managerKey : managerKey.key;
  }

  const protocolConstants = await TezosRpc().getConstants();
  const DEFAULT_PARAMS = await self.getOperationLimits(protocolConstants, batchParams.length);
  const revealNeeded = await self.isRevealOpNeeded(batchParams, pkh);

  const ops: RPCOperation[] = [];
  for (const op of batchParams) {
    if (isOpWithFee(op)) {
      const limits = mergeLimits(op, DEFAULT_PARAMS);
      ops.push(await getRPCOp({ ...op, ...limits }));
    } else {
      ops.push({ ...op });
    }
  }

  if (revealNeeded) {
    assert(publicKey, 'Reveal operation is needed but source address is not defined');

    const revealParams: RevealParams = {
      fee: getRevealFee(pkh),
      storageLimit: REVEAL_STORAGE_LIMIT,
      gasLimit: getRevealGasLimit(pkh),
    };

    const revealOp: RPCRevealOperation = await createRevealOperation(revealParams, pkh, publicKey);
    ops.unshift(revealOp);
  }

  const [hash, protocol, headCounter] = await Promise.all([
    self.getBlockHash(),
    self.getProtocolHash(),
    parseInt(await self.getHeadCounter(pkh), 10),
  ]);

  const contents = self.constructOpContents(ops, headCounter, pkh);
  return {
    opOb: {
      branch: hash,
      contents,
      protocol,
    },
    counter: headCounter,
  };
}
