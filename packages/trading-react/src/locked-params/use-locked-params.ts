"use client";

import {
  getLockedParamsQueryOptions,
  type ConfigParameter,
  type GetLockedParamsOptions,
  type GetLockedParamsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useLockedParams}: the core query options (symbol,
 * leverage, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseLockedParamsParameters = GetLockedParamsOptions & ConfigParameter;

/** Return type of {@link useLockedParams}. */
export type UseLockedParamsReturnType = UseQueryResult<GetLockedParamsReturnType, SymmioRequestError>;

/**
 * Fetch solver locked params for a market/leverage pair.
 *
 * The query is disabled until both `symbol` and a positive `leverage` are set.
 * Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const query = useLockedParams({ symbol: "BTCUSDT", leverage: 5 });
 * ```
 */
export function useLockedParams(parameters: UseLockedParamsParameters): UseLockedParamsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getLockedParamsQueryOptions(config, {
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
  }) as UseLockedParamsReturnType;
}
