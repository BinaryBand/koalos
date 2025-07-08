type Primitive = string | number | boolean;

type MichelsonExpression = import('@taquito/rpc').MichelsonV1Expression;
type MichelsonExpressionBase = import('@taquito/rpc').MichelsonV1ExpressionBase;
type MichelsonExpressionExtended = import('@taquito/rpc').MichelsonV1ExpressionExtended;

type MichelsonView = MichelsonExpressionExtended & {
  prim: 'pair';
  args: [MichelsonExpression, { prim: 'contract'; args: [MichelsonExpression] }];
};

type UnitValue = symbol;

type ContractProvider = import('@taquito/taquito').ContractProvider;

type BigMapAbstraction = import('@taquito/taquito').BigMapAbstraction;

type MichelsonMap<T extends Primitive = Primitive, K = unknown> = import('@taquito/michelson-encoder').MichelsonMap<
  T,
  K
>;

type ContractMethodObject = import('@taquito/taquito').ContractMethodObject<ContractProvider>;

type ContractView<T> = import('@taquito/taquito').ContractView & {
  read: (chainId?: string) => Promise<T>;
};
