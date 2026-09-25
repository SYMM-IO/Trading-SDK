import { getCollateralAllowance, getCollateralBalance } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useSdkScope } from "./use-sdk-scope.js";

/** The wallet's collateral-token balance (collateral decimals). */
export function useCollateralBalance(owner?: Address) {
  const { config, chainId } = useSdkScope();
  return useQuery({
    queryKey: ["collateralBalance", chainId, owner],
    queryFn: () => getCollateralBalance(config, { chainId, owner: owner as Address }),
    enabled: Boolean(owner),
    refetchInterval: 15_000,
  });
}

/** The collateral allowance granted to the SYMMIO core (collateral decimals). */
export function useCollateralAllowance(owner?: Address) {
  const { config, chainId } = useSdkScope();
  return useQuery({
    queryKey: ["collateralAllowance", chainId, owner],
    queryFn: () => getCollateralAllowance(config, { chainId, owner: owner as Address }),
    enabled: Boolean(owner),
    staleTime: 15_000,
  });
}
