import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { QuoteEventsForQuoteByTypeDocument } from "./query-document";
import { toQuoteEventRow } from "./to-quote-event-row";
import { type QuoteEventRow, type QuoteEventType } from "./types";

/** Default page size when `first` is omitted. */
export const DEFAULT_QUOTE_EVENTS_BY_TYPE_PAGE_SIZE = 50;

/**
 * Parameters for {@link getQuoteEventsByType}.
 */
export type GetQuoteEventsByTypeParameters = Compute<
  ChainIdParameter & {
    /** On-chain quote id to read events for. */
    quoteId: bigint;
    /** Event types to include. Use {@link PRICE_HISTORY_EVENT_TYPES}, etc. */
    types: readonly QuoteEventType[];
    /** Page size. @default 50 */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Sort direction on the event timestamp. @default "desc" (newest first). */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getQuoteEventsByType}. */
export interface GetQuoteEventsByTypeReturnType {
  /** The decoded event rows. */
  rows: QuoteEventRow[];
  /** `true` when the page came back full — caller should fetch the next page. */
  hasMore: boolean;
}

/**
 * Read a single quote's non-terminal events (open-price recompute, funding
 * charges) from the analytics subgraph, filtered to the requested event types.
 * The action does no event-type interpretation beyond decoding the metadata JSON
 * — pass {@link PRICE_HISTORY_EVENT_TYPES} for the price-history list.
 *
 * @param config - The SDK config.
 * @param parameters - Quote id, types, pagination, sort, optional chain id.
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
export async function getQuoteEventsByType(
  config: Config,
  parameters: GetQuoteEventsByTypeParameters,
): Promise<GetQuoteEventsByTypeReturnType> {
  const {
    chainId,
    quoteId,
    types,
    first = DEFAULT_QUOTE_EVENTS_BY_TYPE_PAGE_SIZE,
    skip = 0,
    orderDirection = "desc",
  } = parameters;

  if (types.length === 0) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: QuoteEventsForQuoteByTypeDocument,
    variables: {
      quoteId: quoteId.toString(),
      typeIn: types as string[],
      first,
      skip,
      orderDirection,
    },
  });

  const rows = data.quoteEvents.map(toQuoteEventRow);
  return { rows, hasMore: rows.length === first };
}
