import { TezosOperationError } from '@taquito/taquito';
import { OperationContentsAndResult, TezosGenericOperationError } from '@taquito/rpc';

/**
 * Type guard to check if an error is a TezosGenericOperationError array
 * @param error The error to check
 * @returns True if error is TezosGenericOperationError array
 */
export function isTezosGenericOperationError(error: unknown): error is TezosGenericOperationError[] {
  return (
    Array.isArray(error) &&
    error.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof item.id === 'string' &&
        'kind' in item &&
        typeof item.kind === 'string'
    )
  );
}

/**
 * Handles potential operation errors by throwing TezosOperationError if detected
 * @param result The result to check for errors
 * @param message Error message to use
 * @param meta Operation metadata
 * @throws {TezosOperationError} If result contains operation errors
 */
export function handlePotentialOperationError(
  result: unknown,
  message: string,
  meta: OperationContentsAndResult[] = []
): void {
  if (isTezosGenericOperationError(result)) {
    throw new TezosOperationError(result, message, meta);
  }
}
