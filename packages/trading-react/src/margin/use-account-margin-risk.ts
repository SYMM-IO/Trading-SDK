"use client";

import {
  calculateMarginRisk,
  type AccountBalanceInfo,
  type ConfigParameter,
  type MarginRiskMetrics,
} from "@symmio/trading-core";
import { useMemo } from "react";
import type { Address } from "viem";
import { useAccountBalanceInfo } from "../account-layer/use-account-balance-info";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Parameters for {@link useAccountMarginRisk}.
 */
export interface UseAccountMarginRiskParameters extends ConfigParameter {
  /** Account (sub-account or Virtual Account) the metrics describe. Idle until set. */
  account?: Address;
  /**
   * **Signed** unrealized PnL of this **whole** account, wei (positive = in
   * profit). Feed it from `aggregateGroupUpnl` when the account's positions are
   * one group, or from a Muon attestation. Leaving it out reports the account as
   * if it were flat.
   * @default 0n
   */
  upnl?: bigint;
  /**
   * Refetch the balance when an open/close settles on-chain, so the figures do
   * not lag a just-settled trade.
   * @default true
   */
  live?: boolean;
  /** Optional override; defaults to the connected chain. */
  chainId?: number;
}

/**
 * Return type of {@link useAccountMarginRisk}.
 */
export interface UseAccountMarginRiskReturnType {
  /** The account's margin & risk figures; `undefined` until the balance read resolves. */
  metrics?: MarginRiskMetrics;
  /** The raw `balanceInfoOfPartyA` fields the metrics were computed from. */
  balanceInfo?: AccountBalanceInfo;
  /** `true` while the underlying balance query is loading. */
  isLoading: boolean;
  /** Normalized request error, when one occurred. */
  error: SymmioRequestError | null;
}

/**
 * Margin and liquidation-risk state of one account: reads its
 * `balanceInfoOfPartyA` and folds it with the account's unrealized PnL through
 * core's pure {@link calculateMarginRisk}.
 *
 * All arithmetic lives in core; this hook only wires the read to the fold and
 * memoizes the result, so the returned object is referentially stable while the
 * balance and `upnl` are unchanged.
 *
 * **Pass the uPnL of this account's whole book.** `equity = allocatedBalance +
 * upnl`, so feeding the uPnL of a subset (one group of a multi-group account)
 * understates equity and everything derived from it.
 *
 * For a merged position, prefer `useQuoteGroupMarginRisk` — it resolves the
 * group's Virtual Account and folds the group uPnL for you. Reach for this hook
 * directly for an account-level panel, or to fan out over a group that spans
 * several accounts.
 *
 * @param parameters - The account and its uPnL, plus optional chain/config overrides.
 * @returns The account's metrics, the raw balance fields, and query state.
 *
 * @example
 * ```tsx
 * const { metrics, isLoading } = useAccountMarginRisk({ account, upnl });
 * if (metrics?.isLiquidatable) return <LiquidationWarning />;
 * ```
 */
export function useAccountMarginRisk(parameters: UseAccountMarginRiskParameters = {}): UseAccountMarginRiskReturnType {
  const { account, upnl = 0n, live = true, chainId, config } = parameters;

  const balanceQuery = useAccountBalanceInfo({ account, live, chainId, config });
  const balanceInfo = balanceQuery.data;

  const metrics = useMemo(
    () => (balanceInfo ? calculateMarginRisk({ ...balanceInfo, upnl }) : undefined),
    [balanceInfo, upnl],
  );

  return useMemo(
    () => ({ metrics, balanceInfo, isLoading: balanceQuery.isLoading, error: balanceQuery.error }),
    [metrics, balanceInfo, balanceQuery.isLoading, balanceQuery.error],
  );
}
