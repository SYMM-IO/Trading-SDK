import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import type {
  PoolQuotesQuery,
  PoolQuotesQueryVariables,
} from "../../symmio-subgraph/types/generated/analytics/graphql";
import { resolvePoolSource } from "../resolve-pool-source";
import type { PoolQuote } from "../types";
import { PoolQuotesDocument } from "./query-document";
import { toPoolQuote } from "./to-pool-quote";

/** Page size when the caller does not specify one. */
const DEFAULT_PAGE_SIZE = 50;

/**
 * `QuoteStatus` ordinals for a quote that is still pending — sent but not yet
 * opened. Short-lived: a solver accepts within seconds, so this is a "pending
 * orders" view, not what a pool's "open quotes" tab shows.
 *
 * Kept as raw ordinals because that is what the subgraph stores and filters on.
 */
export const POOL_PENDING_QUOTE_STATUSES: readonly number[] = [0, 2];

/**
 * `QuoteStatus` ordinal for a quote that is open on-chain — a live position.
 * These are what a pool's "open quotes" tab shows, one row per position.
 */
export const POOL_OPEN_QUOTE_STATUSES: readonly number[] = [4];

/**
 * Parameters for {@link getPoolQuotes}.
 */
export type GetPoolQuotesParameters = Compute<
  ChainIdParameter & {
    /**
     * The pool's solver market id. A pool with no `symbolId` is not tradable and
     * has no book — the action short-circuits to an empty list.
     */
    symbolId: number | null | undefined;
    /**
     * Raw `QuoteStatus` ordinals to include.
     * @default POOL_PENDING_QUOTE_STATUSES
     */
    quoteStatuses?: readonly number[];
    /** Page size. @default 50 */
    first?: number;
    /** Page offset. @default 0 */
    skip?: number;
    /** Sort direction on the quote timestamp. @default "desc" */
    orderDirection?: "asc" | "desc";
  }
>;

/** Return type of {@link getPoolQuotes}. */
export interface GetPoolQuotesReturnType {
  /** The pool's quote rows for the requested statuses. */
  quotes: PoolQuote[];
}

/**
 * Read a **pool's** quote book from the analytics subgraph.
 *
 * Scoped by the pool's market and the SYMMIO diamond its quotes were opened
 * against, with **no account filter** — so this returns every trader's quotes on
 * the pool, which is what a pool page shows. That makes it a different read from
 * the account-scoped `getSubAccountQuotes`, and `partyA` varies row to row.
 *
 * Which rows you get is entirely the `quoteStatuses` filter: pass
 * {@link POOL_OPEN_QUOTE_STATUSES} for the "open quotes" tab — every live
 * position on the market, one row each — or {@link POOL_PENDING_QUOTE_STATUSES}
 * (the default) for quotes sent but not yet accepted. Pending quotes are
 * short-lived, so that default usually yields a small or empty list.
 *
 * @param config - The SDK config.
 * @param parameters - The pool's `symbolId`, status filter, paging and sort.
 * @returns The quote rows; empty when `symbolId` is absent.
 * @throws {SymmError} when the chain is unsupported or has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { quotes } = await getPoolQuotes(config, {
 *   symbolId: 1,
 *   quoteStatuses: POOL_OPEN_QUOTE_STATUSES,
 * });
 * ```
 */
export async function getPoolQuotes(
  config: Config,
  parameters: GetPoolQuotesParameters,
): Promise<GetPoolQuotesReturnType> {
  const {
    chainId,
    symbolId,
    quoteStatuses = POOL_PENDING_QUOTE_STATUSES,
    first = DEFAULT_PAGE_SIZE,
    skip = 0,
    orderDirection = "desc",
  } = parameters;

  if (symbolId === null || symbolId === undefined) return { quotes: [] };

  const data = await querySubgraph<PoolQuotesQuery, PoolQuotesQueryVariables>(config, {
    chainId,
    document: PoolQuotesDocument,
    variables: {
      symbolId: String(symbolId),
      source: resolvePoolSource(config, chainId),
      quoteStatuses: [...quoteStatuses],
      first,
      skip,
      orderDirection,
    },
  });

  return { quotes: data.quotes.map(toPoolQuote) };
}
