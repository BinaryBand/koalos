type OracleData = {
  tezosPrice: number;
};

type WalletData = {
  address: string;
  balance: number;
  domain?: string;
};

type TezosRecipient = {
  to: string;
  amount: BigNumber;
};
