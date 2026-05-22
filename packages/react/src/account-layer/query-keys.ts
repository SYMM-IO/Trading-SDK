import type { Address } from "viem";

/**
 * React Query key factory for the AccountLayer slice.
 *
 * Centralizing keys keeps cache invalidation predictable: a single root
 * (`["symmio", "account-layer", ...]`) lets callers invalidate everything the
 * SDK knows about an account by prefix, without enumerating every hook.
 *
 * Each `chainId` and the resolved `accountLayerAddress` are included as
 * key segments so two `SymmioProvider`s mounted at different chains never
 * collide in the cache.
 */
export const accountLayerQueryKeys = {
  all: ["symmio", "account-layer"] as const,
  getUserSubAccounts(args: {
    chainId: number;
    accountLayerAddress: Address;
    user: Address;
    offset?: bigint;
    limit?: bigint;
  }) {
    return [
      ...accountLayerQueryKeys.all,
      "getUserSubAccounts",
      {
        chainId: args.chainId,
        accountLayerAddress: args.accountLayerAddress,
        user: args.user,
        offset: (args.offset ?? 0n).toString(),
        limit: (args.limit ?? 200n).toString(),
      },
    ] as const;
  },
};
