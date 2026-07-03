import { BalanceChangeType, BalanceHistoryFilter } from "./types";

/** Every deposit / withdraw movement type, in display order. */
const ALL_BALANCE_CHANGE_TYPES: readonly BalanceChangeType[] = [
  BalanceChangeType.Deposit,
  BalanceChangeType.Withdraw,
  BalanceChangeType.Bridge,
];

/**
 * Map a {@link BalanceHistoryFilter} to the subgraph `BalanceChange.type` values
 * it selects (the `type_in` clause of the history query). A withdraw filter
 * includes bridge withdraws.
 */
export const balanceHistoryFilterToTypes: Record<BalanceHistoryFilter, readonly BalanceChangeType[]> = {
  [BalanceHistoryFilter.All]: ALL_BALANCE_CHANGE_TYPES,
  [BalanceHistoryFilter.Deposit]: [BalanceChangeType.Deposit],
  [BalanceHistoryFilter.Withdraw]: [BalanceChangeType.Withdraw, BalanceChangeType.Bridge],
};
