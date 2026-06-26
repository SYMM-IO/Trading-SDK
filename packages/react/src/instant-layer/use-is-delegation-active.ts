"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getIsDelegationActiveQueryOptions,
  type ConfigParameter,
  type GetIsDelegationActiveOptions,
  type GetIsDelegationActiveReturnType,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useIsDelegationActive}: the core query options
 * (account, delegate, selector, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseIsDelegationActiveParameters = GetIsDelegationActiveOptions & ConfigParameter;

/** Return type of {@link useIsDelegationActive}. */
export type UseIsDelegationActiveReturnType = UseQueryResult<GetIsDelegationActiveReturnType, SymmioRequestError>;

/**
 * Read whether one Instant Layer delegation is active according to the
 * contract. Omitted `chainId` resolves through the SDK config.
 *
 * @example
 * ```tsx
 * const { data: isActive } = useIsDelegationActive({ account, delegate, selector });
 * ```
 */
export function useIsDelegationActive(parameters: UseIsDelegationActiveParameters): UseIsDelegationActiveReturnType {
  const config = useSymmioConfig(parameters);
  const options = getIsDelegationActiveQueryOptions(config, parameters);

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseIsDelegationActiveReturnType;
}
