import BigNumber from 'bignumber.js';

/**
 * Asserts that a given condition is true at runtime.
 * If the condition is false, throws an Error with the provided message or a default message.
 *
 * @param condition - The condition to assert. If falsy, an error is thrown.
 * @param message - Optional error message to display if the assertion fails.
 * @throws {Error} If the condition is falsy.
 */
export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

/**
 * Converts a raw balance value to its decimal representation based on the provided number of decimals.
 *
 * @param rawBalance - The raw balance as a number or BigNumber.
 * @param decimals - (Optional) The number of decimal places to consider. Defaults to 0 if not provided.
 * @returns The balance as a number, adjusted for the specified decimals.
 */
export function convertToBalance(rawBalance: number | BigNumber, decimals?: number): number {
  const decimalFactor: number = Math.pow(10, decimals ?? 0);
  return (rawBalance instanceof BigNumber ? rawBalance.toNumber() : rawBalance) / decimalFactor;
}

/**
 * Determines whether the provided item is a valid JSON object.
 *
 * Attempts to stringify the input if it is not already a string, then parses it as JSON.
 * Returns `true` if parsing succeeds and the result is truthy, otherwise returns `false`.
 *
 * @param item - The value to check for JSON validity.
 * @returns `true` if the item is valid JSON and represents a non-falsy value, otherwise `false`.
 */
export function isJson(item: unknown): item is Record<string, unknown> {
  let value: string = typeof item !== 'string' ? JSON.stringify(item) : item;
  try {
    value = JSON.parse(value);
  } catch (e) {
    return false;
  }

  return Boolean(value);
}

/**
 * Type guard that checks if a value is neither `undefined`, `null`, nor `false`.
 *
 * @param value - The value to check.
 * @returns `true` if the value is not `undefined`, `null`, or `false`; otherwise, `false`.
 */
export function isDefined(value: unknown): value is NonNullable<unknown> {
  return value !== undefined && value !== null && value !== false;
}
