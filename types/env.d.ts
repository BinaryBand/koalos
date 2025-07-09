declare type Primitive = string | number | boolean;

declare type MichelsonV1Expression = import('@taquito/rpc').MichelsonV1Expression;
declare type MichelsonV1ExpressionBase = import('@taquito/rpc').MichelsonV1ExpressionBase;
declare type MichelsonV1ExpressionExtended = import('@taquito/rpc').MichelsonV1ExpressionExtended;
declare type TransactionOperationParameter = import('@taquito/rpc').TransactionOperationParameter;
declare type ScriptResponse = import('@taquito/rpc').ScriptResponse;
declare type PreparedOperation = import('@taquito/taquito').PreparedOperation;

declare type Reveal = import('@/tezos/operations').Reveal;
declare type Transaction = import('@/tezos/operations').Transaction;
declare type Operation = import('@/tezos/operations').Operation;
