"use client";

import {
  getNotionalCapPageQueryOptions,
  type ConfigParameter,
  type GetNotionalCapPageOptions,
  type GetNotionalCapPageReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { DEFAULT_NOTIONAL_CAP_POLLING_MS } from "./use-notional-cap-by-symbol-id";

/**
 * Parameters for {@link useNotionalCapPage}: the core query options plus an
 * optional `config` and a `pollingInterval` knob layered on top of
 * `query.refetchInterval`.
 * @example const parameters: UseNotionalCapPageParameters = { offset: 100, pollingInterval: false };
 */
export type UseNotionalCapPageParameters = GetNotionalCapPageOptions &
  ConfigParameter & {
    /**
     * Polling cadence in milliseconds. Defaults to
     * {@link DEFAULT_NOTIONAL_CAP_POLLING_MS}. Pass `false` to disable polling.
     */
    pollingInterval?: number | false;
  };

/**
 * Query state for a cap page, including normalized SDK errors and refetch state.
 * @example const result: UseNotionalCapPageReturnType = useNotionalCapPage({ limit: 50 });
 */
export type UseNotionalCapPageReturnType = UseQueryResult<GetNotionalCapPageReturnType, SymmioRequestError>;

/**
 * Read one page of market notional caps. Surfaces the page-only
 * `totalOpenInterest` / `totalUsed` plus the per-symbol rows.
 *
 * Polls every {@link DEFAULT_NOTIONAL_CAP_POLLING_MS} by default; pass
 * `pollingInterval` to change or disable.
 *
 * @param parameters - Page limits, deployment, config and query overrides.
 * @returns Query state containing one page of numeric-dollar caps.
 * @throws {SymmioRequestError} Action failures are normalized in query error state.
 * @example
 * ```tsx
 * const { data } = useNotionalCapPage({ limit: 100, offset: 100 });
 * console.log(data?.totalOpenInterest, data?.symbols.length);
 * ```
 */
export function useNotionalCapPage(parameters: UseNotionalCapPageParameters = {}): UseNotionalCapPageReturnType {
  const { pollingInterval = DEFAULT_NOTIONAL_CAP_POLLING_MS, query, ...rest } = parameters;
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getNotionalCapPageQueryOptions(config, {
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
  }) as UseNotionalCapPageReturnType;
}
