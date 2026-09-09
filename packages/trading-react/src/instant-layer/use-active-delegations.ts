"use client";

import {
  getActiveDelegationsQueryOptions,
  type ConfigParameter,
  type GetActiveDelegationsOptions,
  type GetActiveDelegationsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useActiveDelegations}: the core query options
 * (delegator, delegates, selectors, chain id, TanStack `query` overrides) plus
 * an optional `config`.
 */
export type UseActiveDelegationsParameters = GetActiveDelegationsOptions & ConfigParameter;

/** Return type of {@link useActiveDelegations}. */
export type UseActiveDelegationsReturnType = UseQueryResult<GetActiveDelegationsReturnType, SymmioRequestError>;

/**
 * Read which of the probed `(delegate, selector)` pairs the Instant Layer
 * currently enforces, in one call.
 *
 * **Prefer this over {@link useIsDelegationActive} when the delegator may be a
 * virtual account.** The underlying getter canonicalizes a VA to its parent
 * sub-account the way enforcement does; the single-selector read hits the raw
 * mapping and reports `false` for a VA whose parent holds the grant.
 *
 * @example
 * ```tsx
 * const { data } = useActiveDelegations({
 *   delegator: { addr: subAccount, isPartyB: false },
 *   delegates: [sessionKey],
 *   selectors: [selectorSet],
 * });
 * ```
 */
export function useActiveDelegations(parameters: UseActiveDelegationsParameters): UseActiveDelegationsReturnType {
  const config = useSymmioConfig(parameters);
  const options = getActiveDelegationsQueryOptions(config, parameters);

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseActiveDelegationsReturnType;
}
