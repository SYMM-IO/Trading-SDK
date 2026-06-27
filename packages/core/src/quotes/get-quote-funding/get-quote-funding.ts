import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import { QuotesFundingDocument } from "./query-document";
import { toQuoteFundingRow } from "./to-funding-row";
import type { QuoteFundingData } from "./types";

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
 * Read funding totals (`userPaidFunding`, `userReceivedFunding`) for a batch of
 * quotes from the analytics subgraph, in a single round-trip. Filters by the
 * protocol-level `quoteId` scalar so callers never need the diamond address.
 *
 * Returns both the resolved rows and any input ids the subgraph did not yet
 * surface — callers (typically the React layer) decide whether to refetch on
 * indexing lag.
 *
 * @param config - The SDK config.
 * @param parameters - Quote ids and optional chain id.
 * @returns Funding rows plus the input ids the subgraph did not return.
 * @throws {SymmError} when the chain has no analytics subgraph.
 * @throws {SymmApiError} when the subgraph request fails.
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

  const data = await querySubgraph(config, {
    chainId,
    document: QuotesFundingDocument,
    variables: { ids: quoteIds.map((id) => id.toString()) },
  });

  const rows = data.quotes.map(toQuoteFundingRow);
  const seen = new Set(rows.map((row) => row.quoteId));
  const missingQuoteIds = quoteIds.filter((id) => !seen.has(id));
  return { rows, missingQuoteIds };
}
