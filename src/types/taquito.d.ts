type BigMapAbstraction = import('@taquito/taquito').BigMapAbstraction;

type ContractProvider = import('@taquito/taquito').ContractProvider;

type ContractMethodObject = import('@taquito/taquito').ContractMethodObject<ContractProvider>;

type ContractView<T> = import('@taquito/taquito').ContractView & {
  read: (chainId?: string) => Promise<T>;
};

type BigMapKeyType = import('@taquito/michelson-encoder').BigMapKeyType;

type MichelsonMap<
  T extends BigMapKeyType = BigMapKeyType,
  K = unknown
> = import('@taquito/michelson-encoder').MichelsonMap<T, K>;

type MichelsonExpression = import('@taquito/rpc').MichelsonV1Expression;

type MichelsonExpressionExtended = import('@taquito/rpc').MichelsonV1ExpressionExtended;

type ContractAbstraction<
  A extends {} = {},
  B extends {} = {},
  C extends {} = {},
  D extends {} = {}
> = import('@taquito/taquito').ContractAbstraction<ContractProvider, {}, A, B, C, D>;
