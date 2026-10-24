import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import {
  compactWhere,
  hasEmptyListFilter,
  lowercaseList,
  resolveSubgraphPage,
  stringList,
  toSubgraphPage,
  type SubgraphPage,
  type SubgraphPageParameters,
} from "../../symmio-subgraph/subgraph-filters";
import type { QuoteFundingSettlement_Filter } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { QuoteFundingSettlementsDocument } from "./query-document";
import { toQuoteFundingSettlementRow } from "./to-quote-funding-settlement-row";
import type { QuoteFundingSettlementRow } from "./types";

/**
 * Parameters for {@link getQuoteFundingSettlements}. Every filter is optional and
 * applied only when passed; an empty list filter reads nothing.
 */
export type GetQuoteFundingSettlementsParameters = Compute<
  ChainIdParameter &
    SubgraphPageParameters & {
      /** On-chain quote ids. */
      quoteIds?: readonly bigint[];
      /** The deployment's diamond address (the subgraph's `source`). */
      source?: Address;
      /** PartyA accounts. */
      partyAs?: readonly Address[];
      /** Lower bound on the block timestamp (unix seconds, inclusive). */
      startTime?: number;
      /** Upper bound on the block timestamp (unix seconds, inclusive). */
      endTime?: number;
    }
>;

/** Return type of {@link getQuoteFundingSettlements}: one page of settlements. */
export type GetQuoteFundingSettlementsReturnType = SubgraphPage<QuoteFundingSettlementRow>;

/**
 * Read `QuoteFundingSettlement` entities — one per funding settlement on a
 * quote — from the analytics subgraph. One call returns one page; see
 * {@link SubgraphPageParameters} for paging by cursor.
 *
 * @param config - The SDK config.
 * @param parameters - Optional filters, paging, sort, chain id.
 * @returns One page of decoded settlements.
 * @throws {SymmError} when the chain has no analytics subgraph, or `first` / `skip` is out of range.
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * // One page of a quote's settlements in id order; pass the last row's id as idGt for the next.
 * const { rows, hasMore } = await getQuoteFundingSettlements(config, {
 *   quoteIds: [7334n],
 *   orderBy: "id",
 *   orderDirection: "asc",
 * });
 * ```
 */
export async function getQuoteFundingSettlements(
  config: Config,
  parameters: GetQuoteFundingSettlementsParameters = {},
): Promise<GetQuoteFundingSettlementsReturnType> {
  const { chainId, quoteIds, source, partyAs, startTime, endTime, idGt } = parameters;
  const page = resolveSubgraphPage(parameters);

  if (hasEmptyListFilter(quoteIds, partyAs)) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: QuoteFundingSettlementsDocument,
    variables: {
      where: compactWhere<QuoteFundingSettlement_Filter>({
        quoteId_in: stringList(quoteIds),
        source: source?.toLowerCase(),
        partyA_in: lowercaseList(partyAs),
        timestamp_gte: startTime?.toString(),
        timestamp_lte: endTime?.toString(),
        id_gt: idGt,
      }),
      ...page,
    },
  });

  return toSubgraphPage(data.quoteFundingSettlements.map(toQuoteFundingSettlementRow), page.first);
}
