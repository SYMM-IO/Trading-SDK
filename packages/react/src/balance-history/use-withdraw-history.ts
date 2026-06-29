"use client";

import { BalanceHistoryFilter } from "@symm-frontier/core";
import {
  useBalanceHistory,
  type UseBalanceHistoryParameters,
  type UseBalanceHistoryReturnType,
} from "./use-balance-history";

/**
 * Parameters for {@link useWithdrawHistory}: same as {@link useBalanceHistory} but
 * without `filter` — it is pinned to withdrawals.
 */
export type UseWithdrawHistoryParameters = Omit<UseBalanceHistoryParameters, "filter">;

/**
 * Read a sub-account's **withdraw** history (including bridge withdraws) — a thin
 * wrapper over {@link useBalanceHistory} with `filter` pinned to
 * {@link BalanceHistoryFilter.Withdraw}. Internal margin-transfer legs are
 * excluded by default; override with `internalTransfers`. Disabled until at
 * least one `account` is supplied.
 *
 * @example
 * ```tsx
 * const { data } = useWithdrawHistory({ accounts: [subAccount] });
 * ```
 */
export function useWithdrawHistory(parameters: UseWithdrawHistoryParameters): UseBalanceHistoryReturnType {
  return useBalanceHistory({ ...parameters, filter: BalanceHistoryFilter.Withdraw });
}
