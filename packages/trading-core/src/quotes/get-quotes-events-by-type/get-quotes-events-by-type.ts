import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { toQuoteEventRow } from "../get-quote-events-by-type/to-quote-event-row";
import type { QuoteEventRow, QuoteEventType } from "../get-quote-events-by-type/types";
import { QuoteEventsForQuotesByTypeDocument } from "./query-document";

/**
 * Largest page The Graph will serve, and what this action sends when `first` is
 * omitted — asking below the ceiling would truncate an un-paged caller, and
 * leaving `first` out of the query entirely makes The Graph silently fall back
 * to 100.
 */
const MAX_PAGE_SIZE = 1000;

/**
 * Parameters for {@link getQuotesEventsByType}.
 */
export type GetQuotesEventsByTypeParameters = Compute<
  ChainIdParameter & {
    /** On-chain quote ids to read events for. Order is irrelevant — rows come back merged. */
    quoteIds: readonly bigint[];
    /** Event types to include. Use {@link FUNDING_HISTORY_EVENT_TYPES}, etc. */
    types: readonly QuoteEventType[];
    /**
     * Page size across the whole batch, not per quote id. The subgraph caps it at
     * 1000, and omitting it asks for that ceiling — one round-trip returns as much
     * as the subgraph will serve.
     * @default 1000
     */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Sort direction on the event timestamp. @default "desc" (newest first). */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getQuotesEventsByType}. */
export interface GetQuotesEventsByTypeReturnType {
  /**
   * The decoded event rows for every requested quote id, already merged and
   * sorted by `timestamp` server-side (newest first unless `orderDirection` says
   * otherwise). Each row carries its own `quoteId`, so a caller that needs a
   * per-quote view groups by that field.
   */
  rows: QuoteEventRow[];
  /** `true` when the page came back full — caller should fetch the next page. */
  hasMore: boolean;
}

/**
 * Batched sibling of `getQuoteEventsByType`: read the non-terminal events
 * (open-price recompute, funding charges) of **many** quotes from the analytics
 * subgraph in one round-trip, filtered to the requested event types.
 *
 * The subgraph does the merge: rows for all `quoteIds` come back interleaved and
 * sorted by `timestamp`, newest first by default, and `first` / `skip` page over
 * that merged stream rather than per quote id. Omit `first` and the action asks
 * for the 1000-row ceiling the subgraph enforces, so an un-paged call returns
 * everything one request can serve.
 *
 * Pass {@link FUNDING_HISTORY_EVENT_TYPES} to build a funding timeline for a
 * whole position group. Two caveats for that use case:
 *
 * - These are the funding charges **settled to date** — what the analytics
 *   subgraph has indexed. Funding that has accrued since the last on-chain charge
 *   is not indexed and therefore not included here.
 * - The metadata carries the raw on-chain amounts. Net a row the way the rest of
 *   the SDK does — `fundingReceived − fundingPaid`, so a **positive** net means
 *   the position **earned** funding on that tick, matching
 *   `QuoteFundingData.netReceived`. The raw fields themselves are verbatim from
 *   the subgraph and are never re-signed.
 *
 * The action does no event-type interpretation beyond decoding the metadata JSON.
 *
 * @param config - The SDK config.
 * @param parameters - Quote ids, types, pagination, sort, optional chain id.
 * @returns The decoded rows plus a `hasMore` flag.
 * @throws {SymmError} when the chain is unsupported or has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows, hasMore } = await getQuotesEventsByType(config, {
 *   quoteIds: [7334n, 7335n],
 *   types: FUNDING_HISTORY_EVENT_TYPES,
 * });
 * ```
 */
export async function getQuotesEventsByType(
  config: Config,
  parameters: GetQuotesEventsByTypeParameters,
): Promise<GetQuotesEventsByTypeReturnType> {
  const { chainId, quoteIds, types, first = MAX_PAGE_SIZE, skip = 0, orderDirection = "desc" } = parameters;

  if (quoteIds.length === 0 || types.length === 0) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: QuoteEventsForQuotesByTypeDocument,
    variables: {
      quoteIds: quoteIds.map((id) => id.toString()),
      typeIn: types as string[],
      first,
      skip,
      orderDirection,
    },
  });

  const rows = data.quoteEvents.map(toQuoteEventRow);
  return { rows, hasMore: rows.length === first };
}
