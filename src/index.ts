export * from '@/tezos/encoders';
export * from '@/tezos/smart-contracts/fa-token';
export * from '@/tezos/operations';
export * from '@/tezos/smart-contracts';
export * from '@/tezos/types';

export {
  MichelsonV1Expression,
  MichelsonV1ExpressionBase,
  MichelsonV1ExpressionExtended,
  OpKind,
  PreapplyResponse,
  ScriptResponse,
  TransactionOperationParameter,
} from '@taquito/rpc';
export { withKind, ParamsWithKindExtended, PreparedOperation } from '@taquito/taquito';

export { BigNumber } from 'bignumber.js';

/******************************/

// import { Tezos } from '@/tezos/provider';

// async function main() {
//   const tezos = Tezos();
//   // tezos.setRpcProvider('http://192.168.1.100:8732');
//   const res = await tezos.rpc.getBlockHash();
//   console.log('Block hash:', res);

//   const subscription = tezos.stream.subscribeBlock('head');
//   subscription.on('data', (data) => {
//     console.log('New block:', data.header.level, data.metadata.level_info);
//   });
// }

// main().catch((error) => {
//   console.error(error);
//   process.exit(1);
// });
