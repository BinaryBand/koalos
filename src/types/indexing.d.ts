type TezosBlock = {
  id: number;
  hash: string;
  updates: BalanceUpdates[];
};

type State = {
  [key: string]: BigNumber;
};
