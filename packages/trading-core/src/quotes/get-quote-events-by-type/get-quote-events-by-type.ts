import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { compactWhere, hasEmptyListFilter, toSubgraphPage } from "../../symmio-subgraph/subgraph-filters";
import type { QuoteEvent_Filter } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { QuoteEventsForQuoteByTypeDocument } from "./query-document";
import { toQuoteEventRow } from "./to-quote-event-row";
import type { QuoteEventRow, QuoteEventType, QuoteSubgraphEventType } from "./types";

/** Default page size when `first` is omitted. */
export const DEFAULT_QUOTE_EVENTS_BY_TYPE_PAGE_SIZE = 50;

/**
 * Parameters for {@link getQuoteEventsByType}.
 */
export type GetQuoteEventsByTypeParameters<TType extends QuoteSubgraphEventType = QuoteSubgraphEventType> = Compute<
  ChainIdParameter & {
    /** On-chain quote id to read events for. */
    quoteId: bigint;
    /**
     * Event types to include — e.g. {@link PRICE_HISTORY_EVENT_TYPES}, or any
     * subgraph type such as `"OPEN_POSITION"`. Omit to read every type; an empty
     * array reads nothing. The rows' `type` narrows to what is passed.
     */
    types?: readonly TType[];
    /**
     * The deployment's diamond address (the subgraph's `source`). Omit to match
     * the quote id on any deployment the subgraph indexes.
     */
    source?: Address;
    /** Page size. @default 50 */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Sort direction on the event timestamp. @default "desc" (newest first). */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getQuoteEventsByType}. */
export interface GetQuoteEventsByTypeReturnType<TType extends QuoteSubgraphEventType = QuoteEventType> {
  /** The decoded event rows. */
  rows: QuoteEventRow<TType>[];
  /** `true` when the page came back full — caller should fetch the next page. */
  hasMore: boolean;
}

/**
 * Read a single quote's events from the analytics subgraph, optionally filtered
 * to the requested event types and deployment. The action does no event-type
 * interpretation beyond decoding the metadata JSON — pass
 * {@link PRICE_HISTORY_EVENT_TYPES} for the price-history list.
 *
 * @param config - The SDK config.
 * @param parameters - Quote id, optional types and diamond, pagination, sort, optional chain id.
 * @returns The decoded rows plus a `hasMore` flag.
 * @throws {SymmError} when the chain is unsupported or has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows, hasMore } = await getQuoteEventsByType(config, {
 *   quoteId: 7334n,
 *   types: PRICE_HISTORY_EVENT_TYPES,
 * });
 * ```
 */
export async function getQuoteEventsByType<TType extends QuoteSubgraphEventType = QuoteSubgraphEventType>(
  config: Config,
  parameters: GetQuoteEventsByTypeParameters<TType>,
): Promise<GetQuoteEventsByTypeReturnType<TType>> {
  const {
    chainId,
    quoteId,
    types,
    source,
    first = DEFAULT_QUOTE_EVENTS_BY_TYPE_PAGE_SIZE,
    skip = 0,
    orderDirection = "desc",
  } = parameters;

  if (hasEmptyListFilter(types)) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: QuoteEventsForQuoteByTypeDocument,
    variables: {
      where: compactWhere<QuoteEvent_Filter>({
        quoteId: quoteId.toString(),
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
