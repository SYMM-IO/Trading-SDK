import { getFeeForUser, getLockedParams, getNotionalCapBySymbolId } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useSdkScope } from "./use-sdk-scope.js";

/** Solver locked-margin percentages (`cva`/`lf`/`partyAmm`/`partyBmm`). */
export function useLockedParams(symbol?: string, leverage?: number) {
  const { config, chainId, solverId } = useSdkScope();
  return useQuery({
    queryKey: ["lockedParams", chainId, solverId, symbol, leverage],
    queryFn: () =>
      getLockedParams(config, { chainId, solverId, symbol: symbol as string, leverage: leverage as number }),
    enabled: Boolean(symbol && leverage && leverage > 0),
    staleTime: 30_000,
  });
}

/** The user's open/close fee rates for a market. */
export function useFeeForUser(user?: Address, symbolId?: number) {
  const { config, chainId } = useSdkScope();
  return useQuery({
    queryKey: ["feeForUser", chainId, user, symbolId],
    queryFn: () => getFeeForUser(config, { chainId, user: user as Address, symbolId: symbolId as number }),
    enabled: Boolean(user && symbolId != null),
    staleTime: 30_000,
  });
}

/** Per-market notional cap / open interest — gates order size. */
export function useNotionalCap(symbolId?: number) {
  const { config, chainId, solverId } = useSdkScope();
  return useQuery({
    queryKey: ["notionalCap", chainId, solverId, symbolId],
    queryFn: () => getNotionalCapBySymbolId(config, { chainId, solverId, symbolId: symbolId as number }),
    enabled: symbolId != null,
    refetchInterval: 15_000,
  });
}
