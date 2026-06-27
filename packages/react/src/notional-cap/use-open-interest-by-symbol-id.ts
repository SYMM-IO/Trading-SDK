"use client";

import {
  getOpenInterestBySymbolIdQueryOptions,
  type ConfigParameter,
  type GetOpenInterestBySymbolIdOptions,
  type GetOpenInterestBySymbolIdReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { DEFAULT_NOTIONAL_CAP_POLLING_MS } from "./use-notional-cap-by-symbol-id";

/**
 * Parameters for {@link useOpenInterestBySymbolId}: the core query options plus
 * an optional `config` and a `pollingInterval` knob layered on top of
 * `query.refetchInterval`.
 */
export type UseOpenInterestBySymbolIdParameters = GetOpenInterestBySymbolIdOptions &
  ConfigParameter & {
    /**
     * Polling cadence in milliseconds. Defaults to
     * {@link DEFAULT_NOTIONAL_CAP_POLLING_MS}. Pass `false` to disable polling.
     */
    pollingInterval?: number | false;
  };

/** Return type of {@link useOpenInterestBySymbolId}. */
export type UseOpenInterestBySymbolIdReturnType = UseQueryResult<
  GetOpenInterestBySymbolIdReturnType,
  SymmioRequestError
>;

/**
 * Read just the open interest and total cap for one market. Thin selector over
 * the solver's `/notional_cap/{symbolId}` endpoint — same call as
 * {@link useNotionalCapBySymbolId} but a smaller return shape for callers that
 * only need those two fields.
 *
 * Polls every {@link DEFAULT_NOTIONAL_CAP_POLLING_MS} by default; pass
 * `pollingInterval` to change or disable.
 *
 * @example
 * ```tsx
 * const { data } = useOpenInterestBySymbolId({ symbolId: 132 });
 * console.log(data?.openInterest, data?.totalCap);
 * ```
 */
export function useOpenInterestBySymbolId(
  parameters: UseOpenInterestBySymbolIdParameters,
): UseOpenInterestBySymbolIdReturnType {
  const { pollingInterval = DEFAULT_NOTIONAL_CAP_POLLING_MS, query, ...rest } = parameters;
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getOpenInterestBySymbolIdQueryOptions(config, {
    ...rest,
    chainId: rest.chainId ?? chainId,
    query: {
      refetchInterval: pollingInterval === false ? false : pollingInterval,
      ...query,
    },
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
  }) as UseOpenInterestBySymbolIdReturnType;
}
