declare type Primitive = string | number | boolean;

declare type MichelsonV1Expression = import('@taquito/rpc').MichelsonV1Expression;
declare type MichelsonV1ExpressionBase = import('@taquito/rpc').MichelsonV1ExpressionBase;
declare type MichelsonV1ExpressionExtended = import('@taquito/rpc').MichelsonV1ExpressionExtended;
declare type RPCOptions = import('@taquito/rpc').RPCOptions;
declare type RPCSimulateOperationParam = import('@taquito/rpc').RPCSimulateOperationParam;
declare type TransactionOperationParameter = import('@taquito/rpc').TransactionOperationParameter;

declare type BigMapResponse = import('@taquito/rpc').BigMapResponse;
declare type BlockResponse = import('@taquito/rpc').BlockResponse;
declare type ConstantsResponse = import('@taquito/rpc').ConstantsResponse;
declare type ContractResponse = import('@taquito/rpc').ContractResponse;
declare type EntrypointsResponse = import('@taquito/rpc').EntrypointsResponse;
declare type ManagerKeyResponse = import('@taquito/rpc').ManagerKeyResponse;
declare type ScriptResponse = import('@taquito/rpc').ScriptResponse;
declare type PreapplyResponse = import('@taquito/rpc').PreapplyResponse;
declare type ProtocolsResponse = import('@taquito/rpc').ProtocolsResponse;
declare type RunViewResult = import('@taquito/rpc').RunViewResult;
declare type StorageResponse = import('@taquito/rpc').StorageResponse;

declare type OpKind = import('@taquito/taquito').OpKind;
declare type withKind<T, K extends OpKind> = import('@taquito/taquito').withKind<T, K>;
declare type ParamsWithKindExtended = import('@taquito/taquito').ParamsWithKindExtended;
declare type PreparedOperation = import('@taquito/taquito').PreparedOperation;

declare type Reveal = import('@/tezos/operations').Reveal;
declare type Transaction = import('@/tezos/operations').Transaction;
declare type Origination = import('@/tezos/operations').Origination;
declare type Operation = import('@/tezos/operations').Operation;
