import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import {
  compactWhere,
  hasEmptyListFilter,
  stringList,
  SUBGRAPH_MAX_PAGE_SIZE,
  toSubgraphPage,
} from "../../symmio-subgraph/subgraph-filters";
import type { QuoteEvent_Filter } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { toQuoteEventRow } from "../get-quote-events-by-type/to-quote-event-row";
import type { QuoteEventRow, QuoteEventType, QuoteSubgraphEventType } from "../get-quote-events-by-type/types";
import { QuoteEventsForQuotesByTypeDocument } from "./query-document";

/**
 * Parameters for {@link getQuotesEventsByType}.
 */
export type GetQuotesEventsByTypeParameters<TType extends QuoteSubgraphEventType = QuoteSubgraphEventType> = Compute<
  ChainIdParameter & {
    /** On-chain quote ids to read events for. Order is irrelevant — rows come back merged. */
    quoteIds: readonly bigint[];
    /**
     * Event types to include — e.g. {@link FUNDING_HISTORY_EVENT_TYPES}, or any
     * subgraph type such as `"OPEN_POSITION"`. Omit to read every type; an empty
     * array reads nothing. The rows' `type` narrows to what is passed.
     */
    types?: readonly TType[];
    /**
     * The deployment's diamond address (the subgraph's `source`). Omit to match
     * the quote ids on any deployment the subgraph indexes.
     */
    source?: Address;
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
export interface GetQuotesEventsByTypeReturnType<TType extends QuoteSubgraphEventType = QuoteEventType> {
  /**
   * The decoded event rows for every requested quote id, already merged and
   * sorted by `timestamp` server-side (newest first unless `orderDirection` says
   * otherwise). Each row carries its own `quoteId`, so a caller that needs a
   * per-quote view groups by that field.
   */
  rows: QuoteEventRow<TType>[];
  /** `true` when the page came back full — caller should fetch the next page. */
  hasMore: boolean;
}

/**
 * Batched sibling of `getQuoteEventsByType`: read the events of **many** quotes
 * from the analytics subgraph in one round-trip, optionally filtered to the
 * requested event types and deployment.
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
 *   is not indexed by the subgraph and therefore not included here — read it
 *   with {@link getQuotePendingFunding}.
 * - The metadata carries the raw on-chain amounts. Net a row the way the rest of
 *   the SDK does — `fundingReceived − fundingPaid`, so a **positive** net means
 *   the position **earned** funding on that tick, matching
 *   `QuoteFundingData.netReceived`. The raw fields themselves are verbatim from
 *   the subgraph and are never re-signed.
 *
 * The action does no event-type interpretation beyond decoding the metadata JSON.
 *
 * @param config - The SDK config.
 * @param parameters - Quote ids, optional types and diamond, pagination, sort, optional chain id.
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
export async function getQuotesEventsByType<TType extends QuoteSubgraphEventType = QuoteSubgraphEventType>(
  config: Config,
  parameters: GetQuotesEventsByTypeParameters<TType>,
): Promise<GetQuotesEventsByTypeReturnType<TType>> {
  // `first` defaults to the ceiling: asking below it would truncate an un-paged
  // caller, and leaving it out of the query makes The Graph fall back to 100.
  const {
    chainId,
    quoteIds,
    types,
    source,
    first = SUBGRAPH_MAX_PAGE_SIZE,
    skip = 0,
    orderDirection = "desc",
  } = parameters;

  if (hasEmptyListFilter(quoteIds, types)) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: QuoteEventsForQuotesByTypeDocument,
    variables: {
      where: compactWhere<QuoteEvent_Filter>({
        quoteId_in: stringList(quoteIds),
        type_in: types as string[] | undefined,
        source: source?.toLowerCase(),
      }),
      first,
      skip,
      orderDirection,
    },
  });

  return toSubgraphPage(
    data.quoteEvents.map((row) => toQuoteEventRow<TType>(row)),
    first,
  );
}
