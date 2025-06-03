type OmniWallet = {
  price: number;
};

type MetaWallet = {
  address: string;
  balance: number;
  domain?: string;
};

type TezosRecipient = {
  to: string;
  amount: BigNumber;
};
