import { createHelia, DefaultLibp2pServices, HeliaLibp2p } from 'helia';
import type { Libp2p } from '@libp2p/interface';
import { unixfs, UnixFS } from '@helia/unixfs';
import { CID } from 'multiformats/cid';
import { assert, isJson } from '../misc.js';

const heliaServer: Promise<HeliaLibp2p<Libp2p<DefaultLibp2pServices>>> = createHelia();
console.log('Helia node started');

const IPFS_URI_REGEX: RegExp = /ipfs:\/\/([a-zA-Z0-9]{46}|[a-zA-Z0-9]{59})/;

export function isIpfsLink(uri: string): boolean {
  return IPFS_URI_REGEX.test(uri);
}

export async function getFromIpfs(uri: string): Promise<unknown> {
  const [match, hash] = IPFS_URI_REGEX.exec(uri) ?? [];
  assert(match !== undefined, `Invalid IPFS link: ${uri}`);

  const cid: CID = CID.parse(hash);
  const heliaNode: HeliaLibp2p<Libp2p<DefaultLibp2pServices>> = await heliaServer;
  const unixFs: UnixFS = unixfs(heliaNode);

  const chunks: Uint8Array[] = [];
  for await (const chunk of unixFs.cat(cid)) {
    chunks.push(chunk);
  }

  const rawBuffer: Uint8Array = Buffer.concat(chunks);
  const rawData: string = new TextDecoder().decode(rawBuffer);
  if (isJson(rawData)) {
    return JSON.parse(rawData);
  }

  return rawData;
}
