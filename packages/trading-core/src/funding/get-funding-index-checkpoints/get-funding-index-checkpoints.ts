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
import type { FundingIndexCheckpoint_Filter } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { FundingIndexCheckpointsDocument } from "./query-document";
import { toFundingIndexCheckpointRow } from "./to-funding-index-checkpoint-row";
import type { FundingIndexCheckpointRow } from "./types";

/**
 * Parameters for {@link getFundingIndexCheckpoints}. Every filter is optional and
 * applied only when passed; an empty list filter reads nothing.
 */
export type GetFundingIndexCheckpointsParameters = Compute<
  ChainIdParameter &
    SubgraphPageParameters & {
      /** The deployment's diamond address (the subgraph's `source`). */
      source?: Address;
      /** Market ids (`symbolId`). */
      marketIds?: readonly number[];
      /** PartyB (solver) addresses. */
      partyBs?: readonly Address[];
      /** Lower bound on the block timestamp (unix seconds, inclusive). */
      startTime?: number;
      /** Upper bound on the block timestamp (unix seconds, inclusive). */
      endTime?: number;
    }
>;

/** Return type of {@link getFundingIndexCheckpoints}: one page of checkpoints. */
export type GetFundingIndexCheckpointsReturnType = SubgraphPage<FundingIndexCheckpointRow>;

/**
 * Read `FundingIndexCheckpoint` entities — the funding-rate index of a market and
 * PartyB at a point in time — from the analytics subgraph. One call returns one
 * page; see {@link SubgraphPageParameters} for paging by cursor.
 *
 * @param config - The SDK config.
 * @param parameters - Optional filters, paging, sort, chain id.
 * @returns One page of decoded checkpoints.
 * @throws {SymmError} when the chain has no analytics subgraph, `first` / `skip` is out of range, or `idGt`
 *   is passed with a sort other than `id` ascending (`INVALID_SUBGRAPH_CURSOR`).
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * // The latest checkpoint at or before a moment.
 * const { rows } = await getFundingIndexCheckpoints(config, {
 *   source: "0xdiamond…",
 *   marketIds: [42],
 *   partyBs: ["0xsolver…"],
 *   endTime: openedAt,
 *   orderDirection: "desc",
 *   first: 1,
 * });
 * ```
 */
export async function getFundingIndexCheckpoints(
  config: Config,
  parameters: GetFundingIndexCheckpointsParameters = {},
): Promise<GetFundingIndexCheckpointsReturnType> {
  const { chainId, source, marketIds, partyBs, startTime, endTime, idGt } = parameters;
  const page = resolveSubgraphPage(parameters);

  if (hasEmptyListFilter(marketIds, partyBs)) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: FundingIndexCheckpointsDocument,
    variables: {
      where: compactWhere<FundingIndexCheckpoint_Filter>({
        source: source?.toLowerCase(),
        symbolId_in: stringList(marketIds),
        partyB_in: lowercaseList(partyBs),
        timestamp_gte: startTime?.toString(),
        timestamp_lte: endTime?.toString(),
        id_gt: idGt,
      }),
      ...page,
    },
  });

  return toSubgraphPage(data.fundingIndexCheckpoints.map(toFundingIndexCheckpointRow), page.first);
}
