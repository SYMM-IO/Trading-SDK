"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getFeeForUserQueryOptions,
  type ConfigParameter,
  type GetFeeForUserOptions,
  type GetFeeForUserReturnType,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useFeeForUser}: the core query options (user, symbol id,
 * optional affiliate, chain id, TanStack `query` overrides) plus an optional
 * `config`.
 */
export type UseFeeForUserParameters = GetFeeForUserOptions & ConfigParameter;

/** Return type of {@link useFeeForUser}. */
export type UseFeeForUserReturnType = UseQueryResult<GetFeeForUserReturnType, SymmioRequestError>;

/**
 * Read SYMMIO fee settings for a user/account and symbol id.
 *
 * Omitted `affiliate` resolves through the chain config. Omitted `chainId`
 * resolves through the connected SYMMIO chain. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useFeeForUser({ user, symbolId: 1n });
 * ```
 */
export function useFeeForUser(parameters: UseFeeForUserParameters): UseFeeForUserReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getFeeForUserQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseFeeForUserReturnType;
}
