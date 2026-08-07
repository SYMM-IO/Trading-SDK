import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { QuotesFundingDocument } from "./query-document";
import { toQuoteFundingRow } from "./to-funding-row";
import type { QuoteFundingData } from "./types";

/**
 * Maximum number of quote ids sent in one `QuotesFunding` request.
 *
 * The Graph caps a `first` argument at 1000 entities per query (and silently
 * defaults to 100 when `first` is omitted), so {@link getQuoteFunding} chunks
 * its input at this size and merges the responses. Exported so callers that
 * size their own batches (and tests) can reuse the exact ceiling.
 */
export const QUOTES_FUNDING_MAX_IDS_PER_REQUEST = 1000;

/**
 * Parameters for {@link getQuoteFunding}.
 */
export type GetQuoteFundingParameters = Compute<
  ChainIdParameter & {
    /** On-chain quote ids to read. */
    quoteIds: readonly bigint[];
  }
>;

/** Return type of {@link getQuoteFunding}. */
export interface GetQuoteFundingReturnType {
  /** One row per quote id the subgraph returned. */
  rows: QuoteFundingData[];
  /** Subset of input ids the subgraph did not return (indexing lag). */
  missingQuoteIds: bigint[];
}

/**
 * Split an id list into request-sized batches of at most
 * {@link QUOTES_FUNDING_MAX_IDS_PER_REQUEST} ids, preserving input order.
 */
function chunkQuoteIds(quoteIds: readonly bigint[]): bigint[][] {
  const batches: bigint[][] = [];
  for (let index = 0; index < quoteIds.length; index += QUOTES_FUNDING_MAX_IDS_PER_REQUEST) {
    batches.push(quoteIds.slice(index, index + QUOTES_FUNDING_MAX_IDS_PER_REQUEST));
  }
  return batches;
}

/**
 * Read funding totals (`userPaidFunding`, `userReceivedFunding`) for a batch of
 * quotes from the analytics subgraph. Filters by the protocol-level `quoteId`
 * scalar so callers never need the diamond address.
 *
 * The action **pages internally**: `quoteIds` is chunked into requests of at
 * most {@link QUOTES_FUNDING_MAX_IDS_PER_REQUEST} ids, issued concurrently, and
 * the responses are merged. Callers pass the full id list — however long — and
 * never need to chunk it themselves. (Without an explicit `first`, The Graph
 * caps a query at 100 entities, which silently truncated large batches; the
 * extras then surfaced as `missingQuoteIds` and any caller that ignored
 * completeness rendered a wrong total.)
 *
 * The returned funding is what the analytics subgraph has **settled to date**:
 * funding accrued since the quote's last funding charge is not indexed and is
 * therefore not included.
 *
 * Returns both the resolved rows and any input ids the subgraph did not yet
 * surface — callers (typically the React layer) decide whether to refetch on
 * indexing lag.
 *
 * @param config - The SDK config.
 * @param parameters - Quote ids and optional chain id.
 * @returns Funding rows (merged across all internal requests) plus the input ids
 *   the subgraph did not return, computed across the full input set.
 * @throws {SymmError} when the chain has no analytics subgraph.
 * @throws {SymmApiError} when any subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows, missingQuoteIds } = await getQuoteFunding(config, { quoteIds: [7334n, 7335n] });
 * ```
 */
export async function getQuoteFunding(
  config: Config,
  parameters: GetQuoteFundingParameters,
): Promise<GetQuoteFundingReturnType> {
  const { chainId, quoteIds } = parameters;

  if (quoteIds.length === 0) return { rows: [], missingQuoteIds: [] };

  const responses = await Promise.all(
    chunkQuoteIds(quoteIds).map((batch) =>
      querySubgraph(config, {
        chainId,
        document: QuotesFundingDocument,
        variables: { ids: batch.map((id) => id.toString()), first: QUOTES_FUNDING_MAX_IDS_PER_REQUEST },
      }),
    ),
  );

  const rows = responses.flatMap((data) => data.quotes.map(toQuoteFundingRow));
  const seen = new Set(rows.map((row) => row.quoteId));
  const missingQuoteIds = quoteIds.filter((id) => !seen.has(id));
  return { rows, missingQuoteIds };
}
