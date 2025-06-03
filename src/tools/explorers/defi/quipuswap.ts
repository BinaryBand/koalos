import { UnitValue } from '@taquito/taquito';
import { ExecutionContextParams } from '@taquito/taquito/dist/types/contract/contract-methods/contract-on-chain-view.js';
import Tezos from '../../../network/taquito.js';

const QUIPUSWAP: string = 'KT1J8Hr3BP8bpbfmgGpRPoC9nAMSYtStZG43';

// type FA12Token = {
//   fa12: string;
// };

// type FA2Token = {
//   fa2: {
//     token: string;
//     id: number;
//   };
// };

// type QuipuswapStorage = {
//   storage: {
//     tokens: {
//       [key: number]: FA12Token | FA2Token;
//     };
//     token_to_id: {
//       [key: string]: { key: string; value: number };
//     };
//     pairs: {
//       [key: number]: {
//         token_a: number;
//         token_b: number;
//       };
//     };
//   };
// };

export async function getTezosToUsdt(): Promise<number> {
  const executionContext: ExecutionContextParams = { viewCaller: QUIPUSWAP };
  const quipuswap = await Tezos().contract.at(QUIPUSWAP);

  const ratio: BigNumber = await quipuswap.contractViews['get_swap_min_res']({
    swaps: [{ direction: { b_to_a: UnitValue }, pair_id: 0 }],
    amount_in: 1e6,
  }).executeView(executionContext);

  return ratio.toNumber() / 1e6; // Convert to XTZ price in USDT
}

export async function getTezosToKusd(): Promise<number> {
  const executionContext: ExecutionContextParams = { viewCaller: QUIPUSWAP };
  const quipuswap = await Tezos().contract.at(QUIPUSWAP);

  const ratio: BigNumber = await quipuswap.contractViews['get_swap_min_res']({
    swaps: [{ direction: { b_to_a: UnitValue }, pair_id: 1 }],
    amount_in: 1e4,
  }).executeView(executionContext);

  return ratio.toNumber() / 1e16; // Convert to XTZ price in KUSD
}
