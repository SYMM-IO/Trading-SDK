"use client";

import {
  getNotionalCapAllQueryOptions,
  type ConfigParameter,
  type GetNotionalCapAllOptions,
  type GetNotionalCapAllReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { DEFAULT_NOTIONAL_CAP_POLLING_MS } from "./use-notional-cap-by-symbol-id";

/**
 * Parameters for {@link useNotionalCapAll}: the core query options plus an
 * optional `config` and a `pollingInterval` knob layered on top of
 * `query.refetchInterval`.
 */
export type UseNotionalCapAllParameters = GetNotionalCapAllOptions &
  ConfigParameter & {
    /**
     * Polling cadence in milliseconds. Defaults to
     * {@link DEFAULT_NOTIONAL_CAP_POLLING_MS}. Pass `false` to disable polling.
     */
    pollingInterval?: number | false;
  };

/** Return type of {@link useNotionalCapAll}. */
export type UseNotionalCapAllReturnType = UseQueryResult<GetNotionalCapAllReturnType, SymmioRequestError>;

/**
 * Read every market's notional cap in one solver call. Surfaces the aggregate
 * `totalOpenInterest` / `totalUsed` plus the per-symbol rows.
 *
 * Polls every {@link DEFAULT_NOTIONAL_CAP_POLLING_MS} by default; pass
 * `pollingInterval` to change or disable.
 *
 * @example
 * ```tsx
 * const { data } = useNotionalCapAll();
 * console.log(data?.totalOpenInterest, data?.symbols.length);
 * ```
 */
export function useNotionalCapAll(parameters: UseNotionalCapAllParameters = {}): UseNotionalCapAllReturnType {
  const { pollingInterval = DEFAULT_NOTIONAL_CAP_POLLING_MS, query, ...rest } = parameters;
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getNotionalCapAllQueryOptions(config, {
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
  }) as UseNotionalCapAllReturnType;
}
