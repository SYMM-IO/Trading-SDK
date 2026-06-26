"use client";

import { useSolverErrorCodes, type UseSolverErrorCodesParameters } from "./use-solver-error-codes";

/**
 * Resolve a single solver error code — the `errorCode` reported on a failed
 * open/close notification or carried on a failed `UnifiedQuote` — to its
 * human-readable message.
 *
 * Returns `undefined` while the code map is loading, when `code` is `null` /
 * absent, or when the solver does not register the code. Wraps
 * {@link useSolverErrorCodes}; `parameters` (chain id, `config`, TanStack
 * `query` overrides) are forwarded to the underlying map query.
 *
 * @param code - The numeric solver error code to resolve.
 * @param parameters - Optional chain id, `config`, and TanStack `query` overrides.
 * @returns The resolved message, or `undefined` when it cannot be resolved.
 *
 * @example
 * ```tsx
 * const message = useSolverErrorMessage(quote.errorCode);
 * if (message) return <ResultError message={message} />;
 * ```
 */
export function useSolverErrorMessage(
  code?: number | null,
  parameters: UseSolverErrorCodesParameters = {},
): string | undefined {
  const { data } = useSolverErrorCodes(parameters);
  if (code == null || !data) return undefined;
  return data[code];
}
