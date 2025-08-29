import { assert } from '@/tools/utils';
import { ipfsUri } from '@public/constants/regex.json';
import { LRUCache } from 'lru-cache';

// --- Constants ---
const IPFS_REGEX: RegExp = new RegExp(ipfsUri);
const DEFAULT_GATEWAY = 'https://ipfs.io/ipfs/';
const DEFAULT_TTL_MS = 5 * 60 * 1000;

// In-memory cache: avoids disk I/O, safe for library usage
const ipfsCache = new LRUCache<string, {}>({
  max: 500,
  ttl: DEFAULT_TTL_MS,
});

export type IpfsFetchOptions = {
  ttlMs?: number;
  gateway?: string; // e.g. https://cloudflare-ipfs.com/ipfs/
};

/**
 * Determines whether the given URI is an IPFS link.
 *
 * @param uri - The URI string to test.
 * @returns `true` if the URI matches the IPFS pattern; otherwise, `false`.
 */
export function isIpfsLink(uri: string): boolean {
  return IPFS_REGEX.test(uri);
}

/**
 * Fetches data from an IPFS URI and returns the parsed content.
 *
 * This function validates the provided IPFS URI, fetches the resource from a public IPFS gateway,
 * and attempts to parse the response as JSON. If the response is valid JSON, it returns the parsed object;
 * otherwise, it returns the raw text data. Responses are cached in-memory with a short TTL.
 *
 * @param uri - The IPFS URI to fetch data from.
 * @param options - Optional gateway override and TTL settings.
 * @returns A promise that resolves to the parsed JSON object if the response is JSON, or the raw string data otherwise.
 * @throws Will throw an error if the URI is invalid or if the fetch request fails.
 */
export async function getFromIpfs<T = unknown>(uri: string, options?: IpfsFetchOptions): Promise<T> {
  const [match, hash] = IPFS_REGEX.exec(uri) ?? [];
  assert(match !== undefined, `Invalid IPFS link: ${uri}`);

  const gateway = (options?.gateway ?? DEFAULT_GATEWAY).replace(/\/+$/, '') + '/';
  const url = `${gateway}${hash}`;

  // Cache key includes gateway to avoid mixing across gateways
  const key = `ipfs:${gateway}:${hash}`;
  const cached = ipfsCache.get(key) as T | undefined;
  if (cached !== undefined) {
    return cached;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch IPFS link: ${uri} (status: ${res.status})`);
  }

  let parsed: T;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    parsed = (await res.json()) as T;
  } else {
    parsed = (await res.text()) as T;
  }

  // Store only defined, non-null values
  if (parsed !== undefined && parsed !== null) {
    ipfsCache.set(key, parsed as {}, { ttl: options?.ttlMs ?? DEFAULT_TTL_MS });
  }

  return parsed;
}
