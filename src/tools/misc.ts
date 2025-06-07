import BigNumber from 'bignumber.js';

export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

export function convertToReadableBalance(rawBalance: number | BigNumber, decimals?: number): number {
  const decimalFactor: number = Math.pow(10, decimals ?? 0);
  return (rawBalance instanceof BigNumber ? rawBalance.toNumber() : rawBalance) / decimalFactor;
}

export function isJson(item: unknown): item is Record<string, unknown> {
  let value: string = typeof item !== 'string' ? JSON.stringify(item) : item;
  try {
    value = JSON.parse(value);
  } catch (e) {
    return false;
  }

  return Boolean(value);
}

export function isNotUndefined(value: unknown): value is NonNullable<unknown> {
  return value !== undefined && value !== null && value !== false;
}
