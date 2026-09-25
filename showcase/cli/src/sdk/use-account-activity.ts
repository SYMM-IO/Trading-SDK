import {
  BalanceHistoryFilter,
  getBalanceHistory,
  getTransferHistory,
  type TransferDirection,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSubAccount } from "./use-sub-accounts.js";

const PAGE_SIZE = 20;

/** Settled collateral deposits and withdrawals for the selected sub-account. */
export function useBalanceActivity(filter: BalanceHistoryFilter, page: number) {
  const { config, chainId } = useSdkScope();
  const { subAccount } = useSubAccount();
  return useQuery({
    queryKey: ["balanceActivity", chainId, subAccount, filter, page],
    queryFn: () =>
      getBalanceHistory(config, {
        chainId,
        accounts: [subAccount as Address],
        filter,
        first: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
    enabled: Boolean(subAccount),
    staleTime: 15_000,
  });
}

/** Internal account/VA margin transfers for the selected sub-account. */
export function useTransferActivity(direction: TransferDirection, page: number) {
  const { config, chainId } = useSdkScope();
  const { subAccount } = useSubAccount();
  return useQuery({
    queryKey: ["transferActivity", chainId, subAccount, direction, page],
    queryFn: () =>
      getTransferHistory(config, {
        chainId,
        accounts: [subAccount as Address],
        direction,
        first: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
    enabled: Boolean(subAccount),
    staleTime: 15_000,
  });
}

export const ACTIVITY_PAGE_SIZE = PAGE_SIZE;
