import { MichelsonMap, MichelsonMapKey, Schema } from '@taquito/michelson-encoder';
import { isIpfsLink, getFromIpfs } from '../../network/helia.js';
import { isTezosLink, getFromTezos } from '../../network/taquito.js';
import { isJson } from '../misc.js';

function unpackMichelsonPrimitive(value: unknown, valueSchema?: Schema): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (valueSchema && 'prim' in valueSchema.val && valueSchema.val.prim) {
    switch (valueSchema.val.prim) {
      case 'bytes':
        return Buffer.from(value, 'hex').toString('utf8');
      case 'timestamp':
        return new Date(value);
    }
  }

  if (MichelsonMap.isMichelsonMap(value)) {
    return unwrapMichelsonMap(value);
  }

  return value;
}

export async function unwrapMichelsonMap<O extends Record<string, unknown>>(
  curr: MichelsonMap<MichelsonMapKey, unknown>,
  contractAddress?: string
): Promise<O> {
  const valueSchema: Schema = curr['valueSchema'];

  // Transform the MichelsonMap into a regular object
  let map: O = Array.from(curr.entries())
    .filter(([_key, val]: [MichelsonMapKey, unknown]) => Boolean(val))
    .reduce((acc: O, [key, val]: [MichelsonMapKey, unknown]) => {
      const value: unknown = unpackMichelsonPrimitive(val, valueSchema);
      return { ...acc, [`${key}`]: value };
    }, {} as O);

  // If the map has an empty string key, it might be a link to metadata
  if ('' in map && typeof map[''] === 'string') {
    // Check if the link is an IPFS or Tezos link
    let metadata: unknown;
    if (isIpfsLink(map[''])) {
      metadata = await getFromIpfs(map['']);
    } else if (isTezosLink(map[''])) {
      metadata = await getFromTezos(map[''], contractAddress);
    }

    // If the metadata is a string and looks like JSON, parse it
    if (typeof metadata === 'string' && isJson(metadata)) {
      metadata = JSON.parse(metadata);
    }

    // Remove the link after unwrapping and merge metadata into root
    if (typeof metadata === 'object' && metadata !== null) {
      map = { ...map, ...metadata };
      delete map[''];
    }
  }

  return map;
}
