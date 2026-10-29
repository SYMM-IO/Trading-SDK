import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { querySubgraph } from "../../symmio-subgraph/query-subgraph";
import {
  compactWhere,
  hasEmptyListFilter,
  lowercaseList,
  resolveSubgraphPage,
  toSubgraphPage,
  type SubgraphPage,
  type SubgraphPageParameters,
} from "../../symmio-subgraph/subgraph-filters";
import type { LiquidationDetail_Filter } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { LiquidationDetailsDocument } from "./query-document";
import { toLiquidationDetailRow } from "./to-liquidation-detail-row";
import type { LiquidationDetailRow } from "./types";

/**
 * Parameters for {@link getLiquidationDetails}. Every filter is optional and
 * applied only when passed; an empty list filter reads nothing. `orderBy:
 * "timestamp"` and the time range both use `liquidationTimestamp`.
 */
export type GetLiquidationDetailsParameters = Compute<
  ChainIdParameter &
    SubgraphPageParameters & {
      /** The deployment's diamond address (the subgraph's `source`). */
      source?: Address;
      /** Liquidated accounts (`partyA`). */
      partyAs?: readonly Address[];
      /** Lower bound on `liquidationTimestamp` (unix seconds, inclusive). */
      startTime?: number;
      /** Upper bound on `liquidationTimestamp` (unix seconds, inclusive). */
      endTime?: number;
    }
>;

/** Return type of {@link getLiquidationDetails}: one page of liquidations. */
export type GetLiquidationDetailsReturnType = SubgraphPage<LiquidationDetailRow>;

/**
 * Read `LiquidationDetail` entities — one per PartyA liquidation — from the
 * analytics subgraph. One call returns one page; see
 * {@link SubgraphPageParameters} for paging by cursor.
 *
 * @param config - The SDK config.
 * @param parameters - Optional filters, paging, sort, chain id.
 * @returns One page of decoded liquidations.
 * @throws {SymmError} when the chain has no analytics subgraph, `first` / `skip` is out of range, or `idGt`
 *   is passed with a sort other than `id` ascending (`INVALID_SUBGRAPH_CURSOR`).
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * const { rows } = await getLiquidationDetails(config, {
 *   source: "0xdiamond…",
 *   partyAs: ["0xvirtualAccount…"],
 * });
 * ```
 */
export async function getLiquidationDetails(
  config: Config,
  parameters: GetLiquidationDetailsParameters = {},
): Promise<GetLiquidationDetailsReturnType> {
  const { chainId, source, partyAs, startTime, endTime, idGt } = parameters;
  const page = resolveSubgraphPage(parameters);

  if (hasEmptyListFilter(partyAs)) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: LiquidationDetailsDocument,
    variables: {
      where: compactWhere<LiquidationDetail_Filter>({
        source: source?.toLowerCase(),
        partyA_in: lowercaseList(partyAs),
        liquidationTimestamp_gte: startTime?.toString(),
        liquidationTimestamp_lte: endTime?.toString(),
        id_gt: idGt,
      }),
      ...page,
      orderBy: page.orderBy === "timestamp" ? "liquidationTimestamp" : "id",
    },
  });

  return toSubgraphPage(data.liquidationDetails.map(toLiquidationDetailRow), page.first);
}
