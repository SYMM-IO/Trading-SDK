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
import type { Quote_Filter } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { SubgraphQuotesDocument } from "./query-document";
import { toSubgraphQuoteRow } from "./to-subgraph-quote-row";
import type { SubgraphQuoteRow } from "./types";

/**
 * Parameters for {@link getSubgraphQuotes}. Every filter is optional and applied
 * only when passed; an empty list filter reads nothing.
 */
export type GetSubgraphQuotesParameters = Compute<
  ChainIdParameter &
    SubgraphPageParameters & {
      /** On-chain quote ids. */
      quoteIds?: readonly bigint[];
      /** The deployment's diamond address (the subgraph's `source`). */
      source?: Address;
      /** Owning accounts (`partyA`). */
      partyAs?: readonly Address[];
    }
>;

/** Return type of {@link getSubgraphQuotes}: one page of quotes. */
export type GetSubgraphQuotesReturnType = SubgraphPage<SubgraphQuoteRow>;

/**
 * Read the analytics subgraph's `Quote` entities, as indexed. For the live
 * on-chain struct use `getQuote`. One call returns one page; see
 * {@link SubgraphPageParameters} for paging by cursor.
 *
 * @param config - The SDK config.
 * @param parameters - Optional filters, paging, sort, chain id.
 * @returns One page of decoded quotes.
 * @throws {SymmError} when the chain has no analytics subgraph, `first` / `skip` is out of range, or `idGt`
 *   is passed with a sort other than `id` ascending (`INVALID_SUBGRAPH_CURSOR`).
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows } = await getSubgraphQuotes(config, { quoteIds: [7334n], source: "0xdiamond…" });
 * ```
 */
export async function getSubgraphQuotes(
  config: Config,
  parameters: GetSubgraphQuotesParameters = {},
): Promise<GetSubgraphQuotesReturnType> {
  const { chainId, quoteIds, source, partyAs, idGt } = parameters;
  const page = resolveSubgraphPage(parameters);

  if (hasEmptyListFilter(quoteIds, partyAs)) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: SubgraphQuotesDocument,
    variables: {
      where: compactWhere<Quote_Filter>({
        quoteId_in: stringList(quoteIds),
        source: source?.toLowerCase(),
        partyA_in: lowercaseList(partyAs),
        id_gt: idGt,
      }),
      ...page,
    },
  });

  return toSubgraphPage(data.quotes.map(toSubgraphQuoteRow), page.first);
}
