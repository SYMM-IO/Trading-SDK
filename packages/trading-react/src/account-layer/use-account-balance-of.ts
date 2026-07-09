"use client";

import {
  getAccountBalanceOfQueryOptions,
  type ConfigParameter,
  type GetAccountBalanceOfOptions,
  type GetAccountBalanceOfReturnType,
  type Notification,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { isSettleNotification, SETTLE_REFETCH_DELAYS_MS } from "../websocket/is-settle-notification";
import { useNotifications } from "../websocket/use-notifications";

/**
 * Parameters for {@link useAccountBalanceOf}: the core query options
 * (account, chain id, TanStack `query` overrides) plus an optional `config` and
 * a `live` flag.
 */
export type UseAccountBalanceOfParameters = GetAccountBalanceOfOptions &
  ConfigParameter & {
    /**
     * Subscribe to the account's on-chain settle notifications and refetch on
     * each open-anchor / close-fill (a shared WebSocket; requires the provider
     * tree). Turn this on wherever the balance must reflect a just-settled trade
     * without a manual refresh.
     * @default false
     */
    live?: boolean;
  };

/** Return type of {@link useAccountBalanceOf}. */
export type UseAccountBalanceOfReturnType = UseQueryResult<GetAccountBalanceOfReturnType, SymmioRequestError>;

/**
 * Read raw `balanceOf` for a SYMMIO account. The query is disabled until
 * `account` is set. Omitted `chainId` resolves through the SDK config. Errors are
 * normalized to {@link SymmioRequestError}. Pass `live: true` to auto-refetch
 * when an open/close settles on-chain.
 *
 * @example
 * ```tsx
 * const { data } = useAccountBalanceOf({ account, live: true });
 * ```
 */
export function useAccountBalanceOf(parameters: UseAccountBalanceOfParameters = {}): UseAccountBalanceOfReturnType {
  const { live, ...queryParameters } = parameters;
  const config = useSymmioConfig(queryParameters);
  const options = getAccountBalanceOfQueryOptions(config, queryParameters);

  const query = useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseAccountBalanceOfReturnType;

  const { refetch } = query;
  useNotifications({
    account: queryParameters.account,
    // Watch the same chain the balance is read from (the query falls back to the
    // config default when chainId is omitted).
    chainId: queryParameters.chainId ?? config.defaultChainId,
    config: queryParameters.config,
    enabled: Boolean(live && queryParameters.account) && queryParameters.query?.enabled !== false,
    onNotification: useCallback(
      (notification: Notification) => {
        if (!isSettleNotification(notification)) return;
        // The on-chain read lags the anchor block, so refetch in a short burst
        // until the post-settle balance lands.
        for (const ms of SETTLE_REFETCH_DELAYS_MS) setTimeout(() => void refetch(), ms);
      },
      [refetch],
    ),
  });

  return query;
}
