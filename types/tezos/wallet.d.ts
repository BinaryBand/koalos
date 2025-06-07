type OracleData = {
  tezosPrice: number;
};

type WalletData = {
  address: string;
  balance: number;
  domain: string | undefined;
};

type TezosRecipient = {
  to: string;
  amount: BigNumber;
};
