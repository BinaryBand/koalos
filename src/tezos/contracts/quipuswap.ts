// import { ExecutionContextParams } from '@taquito/taquito/dist/types/contract/contract-methods/contract-on-chain-view.js';
// import { UnitValue } from '@taquito/taquito';
// import Tezos from '@/tezos/provider';

export const QUIPUSWAP: string = 'KT1J8Hr3BP8bpbfmgGpRPoC9nAMSYtStZG43';

// export async function getTezosToUsdt(): Promise<number> {
//   const executionContext: ExecutionContextParams = { viewCaller: QUIPUSWAP };
//   const quipuswap = await Tezos().contract.at(QUIPUSWAP);

//   const swapMinRes = quipuswap.contractViews['get_swap_min_res'];
//   const ratio: BigNumber = await (swapMinRes as any)({
//     swaps: [{ direction: { b_to_a: UnitValue }, pair_id: 0 }],
//     amount_in: 1e6,
//   }).executeView(executionContext);

//   return ratio.toNumber() / 1e6; // Convert to XTZ price in USDT
// }

// export async function getTezosToKusd(): Promise<number> {
//   const executionContext: ExecutionContextParams = { viewCaller: QUIPUSWAP };
//   const quipuswap = await Tezos().contract.at(QUIPUSWAP);

//   const swapMinRes = quipuswap.contractViews['get_swap_min_res'];
//   const ratio: BigNumber = await (swapMinRes as any)({
//     swaps: [{ direction: { b_to_a: UnitValue }, pair_id: 1 }],
//     amount_in: 1e10,
//   }).executeView(executionContext);

//   return ratio.toNumber() / 1e10; // Convert to XTZ price in KUSD
// }
