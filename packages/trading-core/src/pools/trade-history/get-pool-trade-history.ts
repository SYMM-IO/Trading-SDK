import type { Config } from "../../core/config";
import { closeTypeToEventTypes } from "../../quotes/get-quote-history/close-type";
import { toQuoteHistoryRow } from "../../quotes/get-quote-history/to-history-row";
import { QuoteCloseType, type QuoteHistoryRow } from "../../quotes/get-quote-history/types";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import type {
  PoolQuoteEventsQuery,
  PoolQuoteEventsQueryVariables,
} from "../../symmio-subgraph/types/generated/analytics/graphql";
import { resolvePoolSource } from "../resolve-pool-source";
import { PoolQuoteEventsDocument } from "./query-document";

/** Page size when the caller does not specify one. */
const DEFAULT_PAGE_SIZE = 50;

/**
 * Parameters for {@link getPoolTradeHistory}.
 */
export type GetPoolTradeHistoryParameters = Compute<
  ChainIdParameter & {
    /**
     * The pool's solver market id. A pool with no `symbolId` is not tradable and
     * has no history — the action short-circuits to an empty result.
     */
    symbolId: number | null | undefined;
    /** Close-type filter. @default QuoteCloseType.All */
    closeType?: QuoteCloseType;
    /** Page size. @default 50 */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Sort direction on the event timestamp. @default "desc" */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getPoolTradeHistory}. */
export interface GetPoolTradeHistoryReturnType {
  /** The decoded, snapshot-applied history rows (one per close/liquidation event). */
  rows: QuoteHistoryRow[];
}

/**
 * Read a **pool's** realized trade history from the analytics subgraph.
 *
 * The pool-scoped counterpart to `getQuoteHistory`: that one filters by the
 * accounts you pass, this one filters by the market and the SYMMIO diamond the
 * quotes were opened against, with no account clause at all. The result is every
 * trader's closes on this pool, which is what a pool page shows.
 *
 * Rows come from the immutable `quoteEvents` collection with each event's frozen
 * `metadata` snapshot overlaid, so a quote closed across several partial closes
 * yields several individually-accurate rows rather than repeating its final
 * state.
 *
 * @param config - The SDK config.
 * @param parameters - The pool's `symbolId`, optional close-type filter, paging and sort.
 * @returns The history rows; empty when `symbolId` is absent.
 * @throws {SymmError} when the chain is unsupported or has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows } = await getPoolTradeHistory(config, { symbolId: 1, first: 25 });
 * ```
 */
export async function getPoolTradeHistory(
  config: Config,
  parameters: GetPoolTradeHistoryParameters,
): Promise<GetPoolTradeHistoryReturnType> {
  const {
    chainId,
    symbolId,
    closeType = QuoteCloseType.All,
    first = DEFAULT_PAGE_SIZE,
    skip = 0,
    orderDirection = "desc",
  } = parameters;

  if (symbolId === null || symbolId === undefined) return { rows: [] };

  const data = await querySubgraph<PoolQuoteEventsQuery, PoolQuoteEventsQueryVariables>(config, {
    chainId,
    document: PoolQuoteEventsDocument,
    variables: {
      typeIn: closeTypeToEventTypes[closeType] as string[],
      symbolId: String(symbolId),
      source: resolvePoolSource(config, chainId),
      first,
      skip,
      orderDirection,
    },
  });

  return { rows: (data.quoteEvents ?? []).map(toQuoteHistoryRow) };
}
