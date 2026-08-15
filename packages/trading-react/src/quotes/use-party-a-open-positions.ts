"use client";

import {
  getPartyAOpenPositionsQueryOptions,
  type ConfigParameter,
  type GetPartyAOpenPositionsOptions,
  type GetPartyAOpenPositionsReturnType,
  type Notification,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { zeroAddress } from "viem";
import { useVirtualAccount } from "../account-layer/use-virtual-account";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { isSettleNotification, SETTLE_REFETCH_DELAYS_MS } from "../websocket/is-settle-notification";
import { useNotifications } from "../websocket/use-notifications";

/**
 * Parameters for {@link usePartyAOpenPositions}: the core query options (partyA,
 * pagination, chain id, TanStack `query` overrides) plus an optional `config`
 * and a `live` flag.
 */
export type UsePartyAOpenPositionsParameters = GetPartyAOpenPositionsOptions &
  ConfigParameter & {
    /**
     * Subscribe to settle notifications and burst-refetch when an open/close
     * settles on-chain — so a just-closed position drops (or a partial close's
     * remaining quantity updates) without a manual refresh. Shared WebSocket;
     * requires the provider tree.
     *
     * Settle frames key on the **sub-account**. This resolves the right stream
     * automatically: a Virtual Account (`partyA` on Enigma) is looked up via
     * `getVirtualAccount` and its `parentAccount` sub-account is watched; a
     * cross-margin sub-account (`partyA` on Rasa, `parentAccount == 0x0`) is its
     * own stream. Works for both kinds without the caller supplying the
     * sub-account. `@default false`
     */
    live?: boolean;
  };

/** Return type of {@link usePartyAOpenPositions}. */
export type UsePartyAOpenPositionsReturnType = UseQueryResult<GetPartyAOpenPositionsReturnType, SymmioRequestError>;

/**
 * Read a partyA's open positions (full `Quote` structs) from the SYMMIO core.
 * `partyA` is a virtual account (lowcap) or the sub-account itself
 * (cross-margin). The query is disabled until `partyA` is set. `chainId`
 * defaults to the connected chain. Errors are normalized to
 * {@link SymmioRequestError}. Pass `live: true` to auto-refetch when a close /
 * open settles on-chain — it resolves the owning sub-account's notification
 * stream for you (VA → `parentAccount`, sub-account → itself).
 *
 * @example
 * ```tsx
 * // Rasa (partyA = sub-account) or Enigma (partyA = VA) — `live` handles both.
 * const { data } = usePartyAOpenPositions({ partyA, live: true });
 * ```
 */
export function usePartyAOpenPositions(
  parameters: UsePartyAOpenPositionsParameters = {},
): UsePartyAOpenPositionsReturnType {
  const { live, ...queryParameters } = parameters;
  const config = useSymmioConfig(queryParameters);
  const chainId = useSymmioChainId();
  const resolvedChainId = queryParameters.chainId ?? chainId;
  const partyA = queryParameters.partyA;
  const options = getPartyAOpenPositionsQueryOptions(config, {
    ...queryParameters,
    chainId: resolvedChainId,
  });

  const query = useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UsePartyAOpenPositionsReturnType;

  // Resolve the account whose notification stream carries `partyA`'s settle
  // frames: a VA's frames arrive on its `parentAccount` sub-account; a
  // sub-account (parent `0x0`) is its own. The mapping is fixed at creation so
  // this caches forever, and read only when `live`. If it errors or is still
  // loading, we fall back to `partyA` — already correct for a cross-margin
  // sub-account, so a failed read never breaks the Rasa case.
  const vaDetail = useVirtualAccount({
    account: partyA ?? zeroAddress,
    chainId: resolvedChainId,
    config: queryParameters.config,
    query: { enabled: Boolean(live && partyA) },
  });
  const parentAccount = vaDetail.data?.parentAccount;
  const notificationAccount = parentAccount && parentAccount !== zeroAddress ? parentAccount : partyA;

  const { refetch } = query;
  useNotifications({
    account: notificationAccount,
    chainId: resolvedChainId,
    config: queryParameters.config,
    enabled: Boolean(live && notificationAccount) && queryParameters.query?.enabled !== false,
    onNotification: useCallback(
      (notification: Notification) => {
        if (!isSettleNotification(notification)) return;
        // The on-chain read lags the settle block, so refetch in a short burst
        // until the post-settle positions land.
        for (const ms of SETTLE_REFETCH_DELAYS_MS) setTimeout(() => void refetch(), ms);
      },
      [refetch],
    ),
  });

  return query;
}
