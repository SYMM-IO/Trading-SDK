import type { Address } from "viem";
import { defineQueryKey } from "../utils";

/**
 * Parameters consumed by the {@link accountLayerQueryKeys.getUserSubAccounts}
 * key builder. Exported so callers and the `predicateMatch` utility can
 * reason about the per-field types of the partial they pass.
 */
export interface GetUserSubAccountsKeyArgs {
  chainId: number;
  accountLayerAddress: Address;
  user: Address;
  offset?: bigint;
  limit?: bigint;
}

/** Root prefix for every cache entry owned by the AccountLayer slice. */
const ROOT = ["symmio", "account-layer"] as const;

/**
 * React Query key factory for the AccountLayer slice.
 *
 * Each method-level key builder is tagged via {@link defineQueryKey} so
 * `predicateMatch` from `@symm-frontier/react` can produce invalidation
 * predicates without callers ever hand-building keys.
 *
 * A single root (`["symmio", "account-layer", ...]`) lets callers
 * invalidate everything the SDK knows about an account by prefix.
 *
 * Each `chainId` and the resolved `accountLayerAddress` are included as
 * fields of the trailing params object so two `SymmioProvider`s mounted at
 * different chains never collide in the cache.
 */
export const accountLayerQueryKeys = {
  all: ROOT,

  getUserSubAccounts: defineQueryKey<[GetUserSubAccountsKeyArgs]>(
    [...ROOT, "getUserSubAccounts"],
    (args) =>
      [
        {
          chainId: args.chainId,
          accountLayerAddress: args.accountLayerAddress,
          user: args.user,
          offset: (args.offset ?? 0n).toString(),
          limit: (args.limit ?? 200n).toString(),
        },
      ] as const,
  ),
};
