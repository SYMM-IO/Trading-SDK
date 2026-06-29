"use client";

import { BalanceHistoryFilter } from "@symm-frontier/core";
import {
  useBalanceHistory,
  type UseBalanceHistoryParameters,
  type UseBalanceHistoryReturnType,
} from "./use-balance-history";

/**
 * Parameters for {@link useDepositHistory}: same as {@link useBalanceHistory} but
 * without `filter` — it is pinned to deposits.
 */
export type UseDepositHistoryParameters = Omit<UseBalanceHistoryParameters, "filter">;

/**
 * Read a sub-account's **deposit** history — a thin wrapper over
 * {@link useBalanceHistory} with `filter` pinned to {@link BalanceHistoryFilter.Deposit}.
 * Internal margin-transfer legs are excluded by default; override with
 * `internalTransfers`. Disabled until at least one `account` is supplied.
 *
 * @example
 * ```tsx
 * const { data } = useDepositHistory({ accounts: [subAccount] });
 * ```
 */
export function useDepositHistory(parameters: UseDepositHistoryParameters): UseBalanceHistoryReturnType {
  return useBalanceHistory({ ...parameters, filter: BalanceHistoryFilter.Deposit });
}
