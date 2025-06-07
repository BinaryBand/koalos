import { getFromCache, setInCache } from './cache.js';
import { assert, isJson } from '../tools/misc.js';

const IPFS_URI_REGEX = /ipfs:\/\/([a-zA-Z0-9]{46}|[a-zA-Z0-9]{59})$/;

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

  const res: Response = await fetch(`https://ipfs.io/ipfs/${hash}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch IPFS link: ${uri} (status: ${res.status})`);
  }
  rawData = await res.text();
  setInCache(hash, rawData);

  if (isJson(rawData)) {
    return JSON.parse(rawData);
  }

  return rawData;
}
