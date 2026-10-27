import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { compactWhere, hasEmptyListFilter, lowercaseList, stringList } from "../../symmio-subgraph/subgraph-filters";
import type { Quote_Filter, QuoteEvent_Filter } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { closeTypeToEventTypes } from "./close-type";
import { QuoteEventsForHistoryDocument } from "./query-document";
import { toQuoteHistoryRow } from "./to-history-row";
import { QuoteCloseType, type QuoteHistoryRow } from "./types";

/**
 * The `quote_` filter for the requested accounts, deployment and markets.
 * Cross-margin (`CUSTOM`) quotes carry **no** `subAccount` on the subgraph, so
 * their accounts filter `partyA` (which equals the subaccount address); VA
 * isolation (`MARKET` / `MARKET_DIRECTION`) filters the quote's `subAccount`.
 * Each filter is present only when the caller passed it.
 */
function quoteFilterFor(parameters: GetQuoteHistoryParameters): Quote_Filter {
  const accounts = lowercaseList(parameters.subAccounts);
  const isCrossMargin = parameters.isolationType === SubAccountIsolationType.CUSTOM;
  return compactWhere<Quote_Filter>({
    subAccount_in: isCrossMargin ? undefined : accounts,
    partyA_in: isCrossMargin ? accounts : undefined,
    source: parameters.source?.toLowerCase(),
    symbolId_in: stringList(parameters.marketIds),
  });
}

/** Default page size when `first` is omitted. */
const DEFAULT_PAGE_SIZE = 50;
/** Default upper time bound (far-future unix seconds) when `endTime` is omitted. */
const DEFAULT_END_TIME = 2_000_000_000;

/**
 * Parameters for {@link getQuoteHistory}.
 */
export type GetQuoteHistoryParameters = Compute<
  ChainIdParameter & {
    /**
     * The accounts whose history to read — a SubAccount and/or its Virtual
     * Accounts. Pass every account that may own the relevant quotes. Omit to read
     * every account's history; an empty array reads nothing. All accounts in one
     * call must share the `isolationType` below (they select the same filter
     * field).
     */
    subAccounts?: readonly Address[];
    /**
     * The subaccount's isolation type, which picks the subgraph filter field:
     * `CUSTOM` (cross-margin) filters by `partyA` because those quotes carry no
     * `subAccount`; `MARKET` / `MARKET_DIRECTION` (and the default) filter by the
     * quote's `subAccount`. Omit for VA-isolation reads.
     */
    isolationType?: SubAccountIsolationType;
    /**
     * The deployment's diamond address (the subgraph's `source`). Omit to read
     * every deployment the subgraph indexes.
     */
    source?: Address;
    /** Market ids (`symbolId`) to read. Omit for every market; an empty array reads nothing. */
    marketIds?: readonly number[];
    /** Close-type filter. @default QuoteCloseType.All */
    closeType?: QuoteCloseType;
    /** Page size. @default 50 */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Lower bound on the event timestamp (unix seconds). @default 0 */
    startTime?: number;
    /** Upper bound on the event timestamp (unix seconds). @default 2_000_000_000 */
    endTime?: number;
    /** Sort direction on the event timestamp. @default "desc" */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getQuoteHistory}. */
export interface GetQuoteHistoryReturnType {
  /** The decoded, snapshot-applied history rows (one per close/liquidation event). */
  rows: QuoteHistoryRow[];
}

/**
 * Read a subaccount's closed/liquidated quote history from the analytics
 * subgraph's immutable `quoteEvents` collection.
 *
 * Each row is one terminal event with its frozen `metadata` snapshot overlaid, so
 * a quote closed across multiple partial closes yields multiple, individually
 * accurate rows (see {@link "toQuoteHistoryRow"}). Filtering by account,
 * deployment, market, close type, time range, and pagination all happen
 * server-side. Account, deployment and market filters are optional and applied
 * only when passed.
 *
 * @param config - The SDK config.
 * @param parameters - Optional accounts, deployment, markets, close type, pagination, time range, sort, chain id.
 * @returns The history rows.
 * @throws {SymmError} when the chain is unsupported or has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows } = await getQuoteHistory(config, {
 *   subAccounts: ["0xsub…"],
 *   source: "0xdiamond…",
 *   closeType: QuoteCloseType.Liquidated,
 *   first: 10,
 * });
 * ```
 */
export async function getQuoteHistory(
  config: Config,
  parameters: GetQuoteHistoryParameters,
): Promise<GetQuoteHistoryReturnType> {
  const {
    chainId,
    subAccounts,
    marketIds,
    closeType = QuoteCloseType.All,
    first = DEFAULT_PAGE_SIZE,
    skip = 0,
    startTime = 0,
    endTime = DEFAULT_END_TIME,
    orderDirection = "desc",
  } = parameters;

  if (hasEmptyListFilter(subAccounts, marketIds)) return { rows: [] };

  const quoteFilter = quoteFilterFor(parameters);
  const where = compactWhere<QuoteEvent_Filter>({
    type_in: closeTypeToEventTypes[closeType] as string[],
    timestamp_gte: startTime.toString(),
    timestamp_lte: endTime.toString(),
    quote_: Object.keys(quoteFilter).length > 0 ? quoteFilter : undefined,
  });

  const data = await querySubgraph(config, {
    chainId,
    document: QuoteEventsForHistoryDocument,
    variables: { where, first, skip, orderDirection },
  });

  return { rows: data.quoteEvents.map(toQuoteHistoryRow) };
}
