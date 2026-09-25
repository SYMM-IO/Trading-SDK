import { getPendingWithdrawRequests, getWithdrawableTime } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useSdkScope } from "./use-sdk-scope.js";

/** Pending withdraw requests for the sub-account (finalize / cancel targets). */
export function usePendingWithdraws(user?: Address) {
  const { config, chainId } = useSdkScope();
  return useQuery({
    queryKey: ["pendingWithdraws", chainId, user],
    queryFn: () => getPendingWithdrawRequests(config, { chainId, user: user as Address }),
    enabled: Boolean(user),
    refetchInterval: 15_000,
  });
}

/** The unix-seconds time when a fresh withdraw could be finalized (cooldown). */
export function useWithdrawableTime(user?: Address) {
  const { config, chainId } = useSdkScope();
  return useQuery({
    queryKey: ["withdrawableTime", chainId, user],
    queryFn: () => getWithdrawableTime(config, { chainId, user: user as Address }),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}
