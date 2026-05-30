import { defineQueryKey } from "../utils";

/**
 * Parameters consumed by the {@link marketsQueryKeys.getMarkets} key builder.
 */
export interface GetMarketsKeyArgs {
  chainId: number;
  solverUrl: string;
}

/** Root prefix for every cache entry owned by the Markets slice. */
const ROOT = ["symmio", "markets"] as const;

/**
 * React Query key factory for the Markets slice.
 *
 * Keys are tagged via {@link defineQueryKey} so `predicateMatch` can produce
 * invalidation predicates without callers hand-building keys.
 */
export const marketsQueryKeys = {
  all: ROOT,

  getMarkets: defineQueryKey<[GetMarketsKeyArgs]>(
    [...ROOT, "getMarkets"],
    (args) =>
      [
        {
          chainId: args.chainId,
          solverUrl: args.solverUrl,
        },
      ] as const,
  ),
};
