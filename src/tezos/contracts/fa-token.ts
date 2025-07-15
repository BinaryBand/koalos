import { MichelsonMap, UnitValue } from '@taquito/michelson-encoder';
import { castToBigNumber } from '@taquito/rpc';
import { BigNumber } from 'bignumber.js';

import { Fa2Balance, Fa2BalanceRequest, OperatorUpdate, TZip21TokenMetadata } from '@/tezos/types';
import { TezosContract } from '@/tezos/contracts/index';
import { unwrapMichelsonMap } from '@/tezos/encoders';
import { BigMap } from '@/tezos/contracts/storage';

type TokenMetadata = {
  token_info?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
  1?: MichelsonMap<string, unknown> | TZip21TokenMetadata;
};

class FaToken extends TezosContract {
  public async getTokenMetadata(tokenId: number = 0): Promise<TZip21TokenMetadata | undefined> {
    const bigMap: BigMap | undefined = this.storage.get<BigMap>('token_metadata');

    const tokenMetadata: TokenMetadata | undefined = await bigMap?.get(tokenId);
    const tokenInfo: unknown = tokenMetadata?.['token_info'] ?? tokenMetadata?.['1'];

    if (MichelsonMap.isMichelsonMap(tokenInfo)) {
      const unwrappedMap: TZip21TokenMetadata = unwrapMichelsonMap(tokenInfo);
      return { ...unwrappedMap, ...castToBigNumber(unwrappedMap, []) };
    }

    return tokenInfo as TZip21TokenMetadata;
  }
}

/*****************************************************
 * TZip-5
 * FA1 Interface
 * https://tzip.tezosagora.org/proposal/tzip-5
 *****************************************************/

/*****************************************************
 * TZip-7
 * FA1.2 Interface
 * https://tzip.tezosagora.org/proposal/tzip-7
 *****************************************************/

export class Fa12Token extends FaToken {
  public async transfer(
    from: string,
    to: string,
    value: BigNumber.Value,
    tokenId: number = 0
  ): Promise<TransactionOperationParameter> {
    return this.createMethod({ from, to, value: BigNumber(value), tokenId }, 'transfer');
  }

  public async getBalance(address: string): Promise<BigNumber> {
    return this.executeView<string, BigNumber>(address, 'getBalance');
  }

  public async getTotalSupply(): Promise<BigNumber> {
    return this.executeView<typeof UnitValue, BigNumber>(UnitValue, 'getTotalSupply');
  }
}

/*****************************************************
 * TZip-12
 * FA2 Interface
 * https://tzip.tezosagora.org/proposal/tzip-12
 *****************************************************/

export class Fa2Token extends FaToken {
  public async balanceOf(args: Fa2BalanceRequest[]): Promise<Fa2Balance[]> {
    return this.executeView<Fa2BalanceRequest[], Fa2Balance[]>(args, 'balance_of');
  }

  public async transfer(
    from: string,
    to: string,
    value: BigNumber.Value,
    tokenId: number = 0
  ): Promise<TransactionOperationParameter> {
    return this.createMethod(
      [
        {
          from_: from,
          txs: [{ to_: to, token_id: tokenId, amount: BigNumber(value) }],
        },
      ],
      'transfer'
    );
  }

  async update_operators(ops: OperatorUpdate[]): Promise<TransactionOperationParameter> {
    return this.createMethod(ops, 'update_operators');
  }
}
