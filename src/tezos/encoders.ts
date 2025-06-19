import { BytesLiteral, MichelsonData, MichelsonType, packDataBytes } from '@taquito/michel-codec';
import { b58cencode, prefix } from '@taquito/utils';
import { blake2b } from '@noble/hashes/blake2';

function encode(data: MichelsonData, type?: MichelsonType): string {
  const packedBytes: BytesLiteral = packDataBytes(data, type);
  const hash: Uint8Array = blake2b(Buffer.from(packedBytes.bytes, 'hex'), { dkLen: 32 });
  return b58cencode(hash, prefix.expr);
}

export function toExpr(data: Primitive): string {
  if (typeof data === 'number') {
    return encode({ int: data.toString() });
  } else if (typeof data === 'boolean') {
    return encode({ prim: data ? 'True' : 'False' });
  }

  return encode({ string: data });
}

export function addressToExpr(address: string): string {
  const data: MichelsonData = { string: address };
  const type: MichelsonType = { prim: 'address' };
  return encode(data, type);
}
