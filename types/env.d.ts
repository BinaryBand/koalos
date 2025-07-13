declare type Primitive = string | number | boolean;

declare type MichelsonV1Expression = import('@taquito/rpc').MichelsonV1Expression;
declare type MichelsonV1ExpressionBase = import('@taquito/rpc').MichelsonV1ExpressionBase;
declare type MichelsonV1ExpressionExtended = import('@taquito/rpc').MichelsonV1ExpressionExtended;
declare type PreapplyResponse = import('@taquito/rpc').PreapplyResponse;
declare type PreparedOperation = import('@taquito/taquito').PreparedOperation;
declare type ScriptResponse = import('@taquito/rpc').ScriptResponse;
declare type TransactionOperationParameter = import('@taquito/rpc').TransactionOperationParameter;

declare type ParamsWithKindExtended = import('@taquito/taquito').ParamsWithKindExtended;
declare type withKind<T, K> = import('@taquito/taquito').withKind;

declare type Reveal = import('@/tezos/operations').Reveal;
declare type Transaction = import('@/tezos/operations').Transaction;
declare type Origination = import('@/tezos/operations').Origination;
declare type Operation = import('@/tezos/operations').Operation;
