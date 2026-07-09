"use client";

import {
  getAccountBalanceInfoQueryOptions,
  type ConfigParameter,
  type GetAccountBalanceInfoOptions,
  type GetAccountBalanceInfoReturnType,
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
 * Parameters for {@link useAccountBalanceInfo}: the core query options
 * (account, chain id, TanStack `query` overrides) plus an optional `config` and
 * a `live` flag.
 */
export type UseAccountBalanceInfoParameters = GetAccountBalanceInfoOptions &
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

/** Return type of {@link useAccountBalanceInfo}. */
export type UseAccountBalanceInfoReturnType = UseQueryResult<GetAccountBalanceInfoReturnType, SymmioRequestError>;

/**
 * Read raw `balanceInfoOfPartyA` fields for a SYMMIO account. The query is
 * disabled until `account` is set. Omitted `chainId` resolves through the SDK
 * config. Errors are normalized to {@link SymmioRequestError}. Pass `live: true`
 * to auto-refetch when an open/close settles on-chain.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAccountBalanceInfo({ account, live: true });
 * ```
 */
export function useAccountBalanceInfo(
  parameters: UseAccountBalanceInfoParameters = {},
): UseAccountBalanceInfoReturnType {
  const { live, ...queryParameters } = parameters;
  const config = useSymmioConfig(queryParameters);
  const options = getAccountBalanceInfoQueryOptions(config, queryParameters);

  const query = useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseAccountBalanceInfoReturnType;

  const { refetch } = query;
  const account = queryParameters.account;
  useNotifications({
    account,
    // Watch the same chain the balance is read from (the query falls back to the
    // config default when chainId is omitted).
    chainId: queryParameters.chainId ?? config.defaultChainId,
    config: queryParameters.config,
    enabled: Boolean(live && account) && queryParameters.query?.enabled !== false,
    onNotification: useCallback(
      (notification: Notification) => {
        // Refetch on a balance-moving settle, or on any frame whose `vaAddress`
        // is the exact account being read (its Virtual Account just settled).
        const matchesVa = account !== undefined && notification.vaAddress?.toLowerCase() === account.toLowerCase();
        if (!isSettleNotification(notification) && !matchesVa) return;
        // The on-chain read lags the anchor block, so refetch in a short burst
        // until the post-settle balance lands.
        for (const ms of SETTLE_REFETCH_DELAYS_MS) setTimeout(() => void refetch(), ms);
      },
      [refetch, account],
    ),
  });

  return query;
}
