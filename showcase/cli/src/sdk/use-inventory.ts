import { getInventoryTvl, getInventoryTvlHistory, supportsInventoryService } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useSdkScope } from "./use-sdk-scope.js";

/** Whether the active chain exposes the optional inventory service. */
export function useSupportsInventoryService(): boolean {
  const { config, chainId } = useSdkScope();
  return supportsInventoryService(config, chainId);
}

/** System-wide custodial TVL. This is not the sum of listing-catalog TVL. */
export function useInventoryTvl(enabled = true) {
  const { config, chainId } = useSdkScope();
  const supported = supportsInventoryService(config, chainId);

  return useQuery({
    queryKey: ["inventory", "tvl", chainId],
    queryFn: () => getInventoryTvl(config, { chainId }),
    enabled: enabled && supported,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Custodial TVL snapshots for one listed token. */
export function useInventoryTvlHistory(symbolAddress: string | undefined, enabled = true) {
  const { config, chainId } = useSdkScope();
  const supported = supportsInventoryService(config, chainId);

  return useQuery({
    queryKey: ["inventory", "tvl-history", chainId, symbolAddress],
    queryFn: () => {
      if (!symbolAddress) throw new Error("A pool address is required for inventory history.");
      return getInventoryTvlHistory(config, { chainId, symbolAddress });
    },
    enabled: enabled && supported && Boolean(symbolAddress),
    staleTime: 60_000,
    retry: false,
  });
}
