import { assert } from '@/tools/utils';
import { ipfsUri } from '@public/constants/regex.json';

// --- Constants ---
const IPFS_REGEX: RegExp = new RegExp(ipfsUri);

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
 * otherwise, it returns the raw text data.
 *
 * @param uri - The IPFS URI to fetch data from.
 * @returns A promise that resolves to the parsed JSON object if the response is JSON, or the raw string data otherwise.
 * @throws Will throw an error if the URI is invalid or if the fetch request fails.
 */
export async function getFromIpfs<T = string | object>(uri: string): Promise<T> {
  const [match, hash] = IPFS_REGEX.exec(uri) ?? [];
  assert(match !== undefined, `Invalid IPFS link: ${uri}`);

  const res: Response = await fetch(`https://ipfs.io/ipfs/${hash}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch IPFS link: ${uri} (status: ${res.status})`);
  }

  if (res.headers.get('Content-Type')?.includes('application/json')) {
    return res.json();
  } else {
    return res.text() as T;
  }
}
