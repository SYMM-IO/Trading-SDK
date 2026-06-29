import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { balanceHistoryFilterToTypes } from "./balance-history-filter";
import { BalanceChangesDocument } from "./query-document";
import { toBalanceHistoryRow } from "./to-balance-history-row";
import { BalanceHistoryFilter, type BalanceHistoryRow, type InternalTransfersMode } from "./types";

/** Default page size when `first` is omitted. */
const DEFAULT_PAGE_SIZE = 1000;
/** Default upper time bound (far-future unix seconds) when `endTime` is omitted. */
const DEFAULT_END_TIME = 2_000_000_000;

/**
 * Map an {@link InternalTransfersMode} to the subgraph `isMarginTransferSideEffect_in`
 * list. `"include"` passes both values so the no-constraint case is explicit
 * rather than relying on null-omission semantics.
 */
const INTERNAL_TRANSFERS_TO_MARGIN_SIDE_EFFECT_IN: Record<InternalTransfersMode, boolean[]> = {
  exclude: [false],
  only: [true],
  include: [true, false],
};

/**
 * Parameters for {@link getBalanceHistory}.
 */
export type GetBalanceHistoryParameters = Compute<
  ChainIdParameter & {
    /**
     * The sub-accounts whose deposit / withdraw history to read (e.g. the
     * addresses from `getUserSubAccounts`). The query filters on the movement's
     * `account`, so pass every sub-account to cover. Required; an empty array
     * reads nothing.
     */
    accounts: readonly Address[];
    /** Movement-type filter. @default BalanceHistoryFilter.All */
    filter?: BalanceHistoryFilter;
    /**
     * How to treat internal margin-transfer legs — the `WITHDRAW` / `DEPOSIT`
     * rows that are bookkeeping side effects of moving margin between the user's
     * own SubAccount and a Virtual Account, not real protocol in/out movements.
     * Orthogonal to {@link filter}. @default "exclude"
     */
    internalTransfers?: InternalTransfersMode;
    /** Page size. @default 1000 */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Lower bound on the movement timestamp (unix seconds). @default 0 */
    startTime?: number;
    /** Upper bound on the movement timestamp (unix seconds). @default 2_000_000_000 */
    endTime?: number;
    /** Sort direction on the movement timestamp. @default "desc" */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getBalanceHistory}. */
export interface GetBalanceHistoryReturnType {
  /** The decoded deposit / withdraw rows, newest first by default. */
  rows: BalanceHistoryRow[];
}

/**
 * Read a sub-account's deposit / withdraw history from the analytics subgraph's
 * `balanceChanges` collection.
 *
 * Each row is one settled collateral movement (deposit, withdraw, or bridge
 * withdraw). Filtering by movement type, time range, and pagination all happen
 * server-side. A bridge withdraw is returned as its own {@link BalanceChangeType}
 * but is selected by the `Withdraw` filter.
 *
 * @param config - The SDK config.
 * @param parameters - Accounts, optional type filter, pagination, time range, sort, chain id.
 * @returns The deposit / withdraw rows.
 * @throws {SymmError} when the chain is unsupported or has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows } = await getBalanceHistory(config, {
 *   accounts: ["0xsub…"],
 *   filter: BalanceHistoryFilter.Withdraw,
 *   first: 100,
 * });
 * ```
 */
export async function getBalanceHistory(
  config: Config,
  parameters: GetBalanceHistoryParameters,
): Promise<GetBalanceHistoryReturnType> {
  const {
    chainId,
    accounts,
    filter = BalanceHistoryFilter.All,
    internalTransfers = "exclude",
    first = DEFAULT_PAGE_SIZE,
    skip = 0,
    startTime = 0,
    endTime = DEFAULT_END_TIME,
    orderDirection = "desc",
  } = parameters;

  if (accounts.length === 0) return { rows: [] };

  const data = await querySubgraph(config, {
    chainId,
    document: BalanceChangesDocument,
    variables: {
      accounts: accounts.map((account) => account.toLowerCase()),
      typeIn: balanceHistoryFilterToTypes[filter] as string[],
      isMarginTransferSideEffectIn: INTERNAL_TRANSFERS_TO_MARGIN_SIDE_EFFECT_IN[internalTransfers],
      first,
      skip,
      orderDirection,
      startDate: startTime.toString(),
      endDate: endTime.toString(),
    },
  });

  return { rows: data.balanceChanges.map(toBalanceHistoryRow) };
}
