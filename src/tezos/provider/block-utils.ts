import { RPCOptions } from '@taquito/rpc';

/**
 * Determines whether a block reference is volatile (changes with new head)
 * Volatile: undefined, 'head', 'head~N'
 * Immutable: block hash, numeric level (number or numeric string), 'genesis'
 * @param block The block reference to check
 * @returns True if the block reference is volatile
 */
export function isVolatileBlockRef(block: RPCOptions['block'] | undefined): boolean {
  if (!block || block === 'head') return true;
  if (typeof block === 'string') {
    const s = block.toLowerCase();
    if (s.startsWith('head~')) return true;
    if (s === 'genesis') return false;
    if (/^B[0-9A-Za-z]{50,}$/.test(block)) return false; // likely block hash
    if (/^\d+$/.test(block)) return false; // numeric level as string
  }
  if (typeof block === 'number') return false; // numeric level
  return false; // default to immutable if unknown alias
}

/**
 * Normalizes block reference for consistent caching
 * @param block The block reference to normalize
 * @returns Normalized block reference string
 */
export function normalizeBlockRef(block: RPCOptions['block'] | undefined): string {
  return block?.toString() ?? 'head';
}
