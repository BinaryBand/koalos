import { createHelia, DefaultLibp2pServices, HeliaLibp2p } from 'helia';
import type { Libp2p } from '@libp2p/interface';
import { unixfs, UnixFS } from '@helia/unixfs';
import { CID } from 'multiformats/cid';

import { getFromCache, setInCache } from './cache.js';
import { assert, isJson } from '../tools/misc.js';

const IPFS_URI_REGEX = /ipfs:\/\/([a-zA-Z0-9]{46}|[a-zA-Z0-9]{59})$/;

let Helia: HeliaLibp2p<Libp2p<DefaultLibp2pServices>> | undefined = undefined;

export async function initHelia(): Promise<void> {
  if (Helia === undefined) {
    Helia = await createHelia();
  }
}

export function getHelia(): HeliaLibp2p<Libp2p<DefaultLibp2pServices>> {
  assert(Helia !== undefined, 'Helia node not initialized');
  return Helia;
}

export async function stopHelia(): Promise<void> {
  if (Helia !== undefined) {
    await Helia.stop();
    Helia = undefined;
  }
}

export function isIpfsLink(uri: string): boolean {
  return IPFS_URI_REGEX.test(uri);
}

export async function getFromIpfs(uri: string): Promise<unknown> {
  const [match, hash] = IPFS_URI_REGEX.exec(uri) ?? [];
  assert(match !== undefined, `Invalid IPFS link: ${uri}`);

  let rawData: string | null = await getFromCache(hash);
  if (rawData !== null) {
    return isJson(rawData) ? JSON.parse(rawData) : rawData;
  }

  const unixFs: UnixFS = unixfs(getHelia());

  const cid: CID = CID.parse(hash);
  const chunks: Uint8Array[] = [];
  for await (const chunk of unixFs.cat(cid)) {
    chunks.push(chunk);
  }

  const rawBuffer: Uint8Array = Buffer.concat(chunks);
  rawData = new TextDecoder().decode(rawBuffer);
  setInCache(hash, rawData);

  if (isJson(rawData)) {
    return JSON.parse(rawData);
  }

  return rawData;
}
