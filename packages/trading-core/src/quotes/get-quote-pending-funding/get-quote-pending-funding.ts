import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import type { QuotePendingFunding } from "./types";

/**
 * Default number of quote ids sent in one `getQuoteFundingDebts` `eth_call`.
 *
 * The view costs about 21k gas per id when the id's (symbol, partyB) funding
 * state is already warm, and about 40k for the first id on each pair. 25 ids
 * therefore stay near 1M gas even in the worst case (every id on a different
 * pair). HyperEVM's small blocks are 3M gas and its `eth_call` gas cap is not
 * documented, so the SDK keeps each call well under that budget.
 */
const DEFAULT_BATCH_SIZE = 25;

/**
 * Parameters for {@link getQuotePendingFunding}.
 */
export type GetQuotePendingFundingParameters = Compute<
  ChainIdParameter & {
    /** Quote ids to read — active positions only (see {@link isActiveQuoteStatus}). Duplicates are read once. */
    quoteIds: readonly bigint[];
    /** Ids per `eth_call`. @default 25 */
    batchSize?: number;
  }
>;

/**
 * Return type of {@link getQuotePendingFunding}: one {@link QuotePendingFunding}
 * row per distinct input id, sorted by `quoteId` ascending.
 */
export type GetQuotePendingFundingReturnType = readonly QuotePendingFunding[];

/** Ascending `bigint` comparator for `Array.prototype.sort`. */
function compareQuoteIds(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Read the **pending** (accrued, not yet settled) accumulated funding of a set
 * of quotes from the SYMMIO core diamond.
 *
 * Wraps the diamond view `getQuoteFundingDebts` and **negates** it: the
 * contract is cost-positive (`> 0` means partyA pays), while every SDK funding
 * amount is income-positive, so `pendingNetReceived > 0n` means the position
 * will receive funding and `< 0n` means it owes it.
 *
 * **What the value is.** Each row is exactly what the contract would settle if
 * the quote were charged in the block the RPC ran the call against (its
 * `latest`). It moves in whole-epoch steps
 * (`currentEpoch = floor(block.timestamp / epochDuration)`) and also changes
 * when the solver updates its rates or the quote is charged, partially closed
 * or liquidated — so the amount eventually settled can differ. For a
 * `LIQUIDATED_PENDING` quote treat it as an estimate only.
 *
 * **Pass active positions only.** The view does not check quote status. For a
 * quote a solver locked but never opened (`LOCKED`, `CANCEL_PENDING`, or
 * `CANCELED` / `EXPIRED` after a lock) it returns a meaningless, growing
 * amount. Filter with {@link isActiveQuoteStatus} on a known on-chain status
 * before calling.
 *
 * **Batching.** Ids are de-duplicated, sorted ascending and read in sequential
 * batches of `batchSize` (default 25). Each batch is its own `eth_call` against
 * the RPC's `latest` block, so with more than one batch the rows can come from
 * adjacent blocks. An empty id list resolves to `[]` without any RPC call.
 *
 * **Settled vs pending.** Funding already charged is read from the analytics
 * subgraph with {@link getQuoteFunding}. The two come from different sources at
 * different heights — do not add them into a lifetime total.
 *
 * Behaves the same on v0.8.5 and v0.8.6 chains: the view's inputs and outputs
 * are identical in both generations. One v0.8.5-only edge: with accumulated
 * funding active, a quote whose legacy funding was prepaid into a later epoch
 * makes the view revert, which fails that batch and therefore the whole read.
 *
 * @param config - The SDK config.
 * @param parameters - Quote ids, optional chain id and batch size.
 * @returns One row per distinct id, sorted by `quoteId` ascending.
 * @throws {SymmError} when the chain is not supported, or `batchSize` is not a positive integer.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const rows = await getQuotePendingFunding(config, { quoteIds: [7334n, 7335n] });
 * const total = rows.reduce((sum, row) => sum + row.pendingNetReceived, 0n);
 * ```
 */
export async function getQuotePendingFunding(
  config: Config,
  parameters: GetQuotePendingFundingParameters,
): Promise<GetQuotePendingFundingReturnType> {
  const { chainId, quoteIds, batchSize = DEFAULT_BATCH_SIZE } = parameters;

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new SymmError(
      "validation",
      "INVALID_BATCH_SIZE",
      `getQuotePendingFunding: \`batchSize\` must be a positive integer, got ${batchSize}.`,
    );
  }

  const ids = [...new Set(quoteIds)].sort(compareQuoteIds);
  if (ids.length === 0) return [];

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const rows: QuotePendingFunding[] = [];
  for (let start = 0; start < ids.length; start += batchSize) {
    const batch = ids.slice(start, start + batchSize);
    const debts = await client.readContract({
      address: addresses.symmioAddress,
      abi: symmioAbi,
      functionName: "getQuoteFundingDebts",
      args: [batch],
    });
    batch.forEach((quoteId, index) => {
      const debt = debts[index];
      /** The view returns exactly one debt per id; the guard only satisfies the index type. */
      if (debt !== undefined) rows.push({ quoteId, pendingNetReceived: -debt });
    });
  }

  return rows;
}
