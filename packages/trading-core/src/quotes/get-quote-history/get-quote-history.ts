import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { closeTypeToEventTypes } from "./close-type";
import { QuoteEventsForHistoryDocument } from "./query-document";
import { toQuoteHistoryRow } from "./to-history-row";
import { QuoteCloseType, type QuoteHistoryRow } from "./types";

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
     * Accounts. The query filters on the quote's `subAccount`, so pass every
     * account that may own the relevant quotes. Required; an empty array reads
     * nothing.
     */
    subAccounts: readonly Address[];
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
 * accurate rows (see {@link "toQuoteHistoryRow"}). Filtering by close type, time
 * range, and pagination all happen server-side.
 *
 * @param config - The SDK config.
 * @param parameters - Accounts, optional close-type filter, pagination, time range, sort, chain id.
 * @returns The history rows.
 * @throws {SymmError} when the chain is unsupported or has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows } = await getQuoteHistory(config, {
 *   subAccounts: ["0xsub…"],
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
    closeType = QuoteCloseType.All,
    first = DEFAULT_PAGE_SIZE,
    skip = 0,
    startTime = 0,
    endTime = DEFAULT_END_TIME,
    orderDirection = "desc",
  } = parameters;

  if (subAccounts.length === 0) return { rows: [] };

  const data = await querySubgraph(config, {
    chainId,
    document: QuoteEventsForHistoryDocument,
    variables: {
      typeIn: closeTypeToEventTypes[closeType] as string[],
      subAccounts: subAccounts.map((account) => account.toLowerCase()),
      first,
      skip,
      orderDirection,
      startDate: startTime.toString(),
      endDate: endTime.toString(),
    },
  });

  return { rows: data.quoteEvents.map(toQuoteHistoryRow) };
}
