import type { Address, Hex } from "viem";
import type { MarginTransferType } from "../../balance-history/get-balance-history/types";
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
import type { MarginTransfer_Filter } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { MarginTransfersDocument } from "./query-document";
import { toMarginTransferRow } from "./to-margin-transfer-row";
import type { MarginTransferRow } from "./types";

/**
 * Parameters for {@link getMarginTransfers}. Every filter is optional and applied
 * only when passed; an empty list filter reads nothing.
 */
export type GetMarginTransfersParameters = Compute<
  ChainIdParameter &
    SubgraphPageParameters & {
      /** The deployment's diamond address (the subgraph's `source`). */
      source?: Address;
      /** Transfer types to include — see {@link MarginTransferType}. */
      types?: readonly (MarginTransferType | (string & {}))[];
      /** Transactions the transfers happened in. */
      transactions?: readonly Hex[];
      /** Virtual Accounts the margin moved into or out of. */
      virtualAccounts?: readonly Address[];
      /** SubAccounts that own the Virtual Accounts. */
      subAccounts?: readonly Address[];
      /** Lower bound on the block timestamp (unix seconds, inclusive). */
      startTime?: number;
      /** Upper bound on the block timestamp (unix seconds, inclusive). */
      endTime?: number;
    }
>;

/** Return type of {@link getMarginTransfers}: one page of transfers. */
export type GetMarginTransfersReturnType = SubgraphPage<MarginTransferRow>;

/**
 * Read `MarginTransfer` entities — margin moved between a SubAccount and its
 * Virtual Accounts — from the analytics subgraph. One call returns one page;
 * see {@link SubgraphPageParameters} for paging by cursor.
 *
 * @param config - The SDK config.
 * @param parameters - Optional filters, paging, sort, chain id.
 * @returns One page of decoded transfers.
 * @throws {SymmError} when the chain has no analytics subgraph, `first` / `skip` is out of range, or `idGt`
 *   is passed with a sort other than `id` ascending (`INVALID_SUBGRAPH_CURSOR`).
 * @throws {SymmApiError} when the subgraph request fails.
 *
 * @example
 * ```ts
 * // The margin each open transaction put into its Virtual Account.
 * const { rows } = await getMarginTransfers(config, {
 *   types: [MarginTransferType.Add],
 *   transactions: ["0xopen…"],
 * });
 * ```
 */
export async function getMarginTransfers(
  config: Config,
  parameters: GetMarginTransfersParameters = {},
): Promise<GetMarginTransfersReturnType> {
  const { chainId, source, types, transactions, virtualAccounts, subAccounts, startTime, endTime, idGt } = parameters;
  const page = resolveSubgraphPage(parameters);

  if (hasEmptyListFilter(types, transactions, virtualAccounts, subAccounts)) return { rows: [], hasMore: false };

  const data = await querySubgraph(config, {
    chainId,
    document: MarginTransfersDocument,
    variables: {
      where: compactWhere<MarginTransfer_Filter>({
        source: source?.toLowerCase(),
        type_in: types as string[] | undefined,
        transaction_in: lowercaseList(transactions),
        virtualAccount_in: lowercaseList(virtualAccounts),
        subAccount_in: lowercaseList(subAccounts),
        timestamp_gte: startTime?.toString(),
        timestamp_lte: endTime?.toString(),
        id_gt: idGt,
      }),
      ...page,
    },
  });

  return toSubgraphPage(data.marginTransfers.map(toMarginTransferRow), page.first);
}
