"use client";

import { useFlowWriteOption, useSessionKeyDefault } from "@/features/gasless/gasless-write-mode-store";
import { useAreDelegationsActive } from "@symmio/trading-react";
import { useEffect, useState } from "react";
import { zeroAddress, type Address, type Hex } from "viem";

/** Withdrawal UI preference: use the owner unless the selected key has this operation's authority. */
export function useWithdrawalWriteOption(parameters: {
  account?: Address;
  chainId?: number;
  selectors: readonly Hex[];
  policyKnown: boolean;
}) {
  const requested = useFlowWriteOption("initiateWithdraw");
  const preference = useSessionKeyDefault();
  const [expiryTick, setExpiryTick] = useState(0);
  const enabled = Boolean(
    requested.from && parameters.account && parameters.policyKnown && parameters.selectors.length,
  );
  const delegation = useAreDelegationsActive({
    account: { addr: parameters.account ?? zeroAddress, isPartyB: false },
    delegate: requested.from ?? zeroAddress,
    selectors: parameters.selectors,
    chainId: parameters.chainId,
    query: { enabled, retry: false, staleTime: 0 },
  });
  const checking = Boolean(
    requested.from && (!enabled || delegation.query.isPending || delegation.query.isPlaceholderData),
  );
  const expiresAt = Math.min(Number(delegation.expiryTimestamp ?? 0n) * 1000, preference.sessionKeyExpiresAtMs ?? 0);
  useEffect(() => {
    const remaining = expiresAt - Date.now();
    if (!requested.from || remaining <= 0) return;
    const timer = setTimeout(() => setExpiryTick((value) => value + 1), Math.min(remaining + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAt, requested.from, expiryTick]);
  const authorized = !checking && !delegation.isError && delegation.allActive && expiresAt > Date.now();

  return {
    write: requested.from && authorized ? requested : {},
    checking,
    ownerFallback: Boolean(requested.from && !checking && !authorized),
    readFailed: delegation.isError,
    refresh: delegation.refetch,
  };
}
