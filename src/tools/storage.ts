import { packData, MichelsonData, MichelsonType } from '@taquito/michel-codec';
import { b58cencode, prefix } from '@taquito/utils';

import { Buffer } from 'buffer';
import blake from 'blakejs';

function blake2b(input: string): Uint8Array;
function blake2b(input: Uint8Array): Uint8Array;
function blake2b(input: string | Uint8Array): Uint8Array {
  if (typeof input === 'string') {
    input = Buffer.from(input, 'hex');
  }
  return blake.blake2b(input, undefined, 32);
}

export function toExprHash(d: MichelsonData, t?: MichelsonType): string {
  const target: Uint8Array = new Uint8Array(packData(d, t));
  const hash: Uint8Array = blake2b(target);
  return b58cencode(hash, prefix.expr);
}

// // Get full BigMap
// https://rpc.tzkt.io/mainnet/chains/main/blocks/head/context/big_maps/743453
