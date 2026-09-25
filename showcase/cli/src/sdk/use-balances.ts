import { getAccountBalanceInfo, getAccountBalanceOf } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { isCrossMarginIsolation } from "../lib/sub-account.js";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSubAccount } from "./use-sub-accounts.js";

/** Available (deallocated) balance, 18-dec. VA-isolated instant trades spend this balance. */
export function useAvailableBalance(account?: Address, refetchInterval = 12_000) {
  const { config, chainId } = useSdkScope();
  return useQuery({
    queryKey: ["balanceOf", chainId, account],
    queryFn: () => getAccountBalanceOf(config, { chainId, account: account as Address }),
    enabled: Boolean(account),
    refetchInterval,
  });
}

/** Full balance breakdown — allocated + locked CVA/LF/PartyAMM, 18-dec. */
export function useBalanceInfo(account?: Address, refetchInterval = 12_000) {
  const { config, chainId } = useSdkScope();
  return useQuery({
    queryKey: ["balanceInfo", chainId, account],
    queryFn: () => getAccountBalanceInfo(config, { chainId, account: account as Address }),
    enabled: Boolean(account),
    refetchInterval,
  });
}

/** Balance the selected account's instant trades actually spend. */
export function useTradingBalance(account?: Address, refetchInterval = 12_000) {
  const { subAccountDetail } = useSubAccount();
  const available = useAvailableBalance(account, refetchInterval);
  const info = useBalanceInfo(account, refetchInterval);
  const isCrossMargin = isCrossMarginIsolation(subAccountDetail?.isolationType);

  return {
    data: isCrossMargin ? info.data?.allocatedBalance : available.data,
    isLoading: isCrossMargin ? info.isLoading : available.isLoading,
    error: isCrossMargin ? info.error : available.error,
    refetch: isCrossMargin ? info.refetch : available.refetch,
    isCrossMargin,
  };
}
