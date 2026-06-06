"use client";

import {
  getDelegationExpiryQueryOptions,
  type ConfigParameter,
  type GetDelegationExpiryOptions,
  type GetDelegationExpiryReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useDelegationExpiry}: the core query options (account,
 * delegate, selector, chain id, TanStack `query` overrides) plus an optional
 * `config`.
 */
export type UseDelegationExpiryParameters = GetDelegationExpiryOptions & ConfigParameter;

/** Return type of {@link useDelegationExpiry}. */
export type UseDelegationExpiryReturnType = UseQueryResult<GetDelegationExpiryReturnType, SymmioRequestError>;

/**
 * Read the raw Instant Layer delegation expiry timestamp for one account,
 * delegate, and selector. Omitted `chainId` resolves through the SDK config.
 *
 * @example
 * ```tsx
 * const { data: expiryTimestamp } = useDelegationExpiry({ account, delegate, selector });
 * ```
 */
export function useDelegationExpiry(parameters: UseDelegationExpiryParameters): UseDelegationExpiryReturnType {
  const config = useSymmioConfig(parameters);
  const options = getDelegationExpiryQueryOptions(config, parameters);

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseDelegationExpiryReturnType;
}
