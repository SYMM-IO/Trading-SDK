import { calculateAvailableForOrder, getMuonUpnlAQueryOptions } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useBalanceInfo } from "./use-balances.js";
import { useSdkScope } from "./use-sdk-scope.js";

export interface VirtualAccountMargin {
  /** Total collateral currently allocated to the whole Virtual Account. */
  allocatedBalance: bigint | undefined;
  /** Maximum the VA can release at the attested uPnL without spending its aggregate locks. */
  removableBalance: bigint | undefined;
  /** Whether a balance or required Muon uPnL read is still loading. */
  isLoading: boolean;
  /** First required read error, or null. */
  error: unknown;
}

/**
 * Read one VA's aggregate allocation and protocol-safe removable balance.
 * Removal uses the whole VA's Muon uPnL and every current/pending lock through
 * `calculateAvailableForOrder`, then caps the result at collateral actually
 * allocated on-chain. This is VA-scoped so shared MARKET_DIRECTION positions
 * cannot expose another quote's locked margin as removable.
 */
export function useVirtualAccountMargin(virtualAccount?: Address, removableEnabled = true): VirtualAccountMargin {
  const { config, chainId } = useSdkScope();
  const balanceInfo = useBalanceInfo(virtualAccount);
  const upnl = useQuery(
    getMuonUpnlAQueryOptions(config, {
      chainId,
      partyA: virtualAccount as Address,
      query: {
        enabled: removableEnabled && virtualAccount != null,
        refetchInterval: 5_000,
        retry: 1,
        staleTime: 0,
      },
    }),
  );

  const allocatedBalance = balanceInfo.error == null ? balanceInfo.data?.allocatedBalance : undefined;
  let removableBalance: bigint | undefined;
  if (
    removableEnabled &&
    balanceInfo.error == null &&
    upnl.error == null &&
    balanceInfo.data != null &&
    upnl.data != null
  ) {
    const availableForOrder = calculateAvailableForOrder({
      balanceInfo: balanceInfo.data,
      upnl: upnl.data.uPnl,
    });
    removableBalance = availableForOrder > 0n ? availableForOrder : 0n;
    if (removableBalance > balanceInfo.data.allocatedBalance) {
      removableBalance = balanceInfo.data.allocatedBalance;
    }
  }

  return {
    allocatedBalance,
    removableBalance,
    isLoading: balanceInfo.isLoading || (removableEnabled && upnl.isLoading),
    error: balanceInfo.error ?? (removableEnabled ? upnl.error : null),
  };
}
