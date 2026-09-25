"use client";

import type { FundingAccount } from "@/features/accounts/account-provider";
import { useSessionKey } from "@/features/session-key/use-session-key";
import { accountLayerAbi } from "@symmio/trading-core";
import { useAreDelegationsActive, useGrantDelegation } from "@symmio/trading-react";
import { useCallback } from "react";
import { toFunctionSelector, zeroAddress, type Abi, type AbiFunction, type Address, type Hex } from "viem";
import { DELEGATION_TTL_SECONDS } from "./use-trading-delegation";

const POSITION_MARGIN_SELECTORS = [selectorFromAbi("addMargin"), selectorFromAbi("removeMargin")] as const;

export interface PositionMarginDelegation {
  /** The local signer used after the wallet grants the two margin selectors. */
  sessionKey: Address | null;
  /** Whether both add and remove margin are currently authorised. */
  isActive: boolean;
  /** Whether the local key or its on-chain delegation is still loading. */
  isLoading: boolean;
  /** Grants both margin selectors in one gasless owner-signed operation. */
  grant: () => Promise<void>;
  isGranting: boolean;
  error: Error | null;
}

/**
 * Authorisation for promptless position-margin changes.
 *
 * Margin changes are relayed through GaslessQ, but the operation is still
 * signed. The connected wallet signs the one-time delegation; every later
 * add/remove operation is signed locally by the session key.
 */
export function usePositionMarginDelegation(account: FundingAccount): PositionMarginDelegation {
  const session = useSessionKey();
  const enabled = Boolean(session.address);

  const probe = useAreDelegationsActive({
    account: { addr: account.address, isPartyB: false },
    delegate: session.address ?? zeroAddress,
    selectors: POSITION_MARGIN_SELECTORS,
    chainId: account.deployment.chainId,
    query: { enabled },
  });
  const grantMutation = useGrantDelegation();

  const grant = useCallback(async () => {
    if (!session.address) return;

    await grantMutation.mutateAsync({
      account: { addr: account.address, isPartyB: false },
      delegatedSigner: session.address,
      selectors: POSITION_MARGIN_SELECTORS,
      expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
      chainId: account.deployment.chainId,
      gasless: true,
    });
    await probe.refetch();
  }, [account.address, account.deployment.chainId, grantMutation, probe, session.address]);

  return {
    sessionKey: session.address,
    isActive: enabled && probe.allActive,
    isLoading: session.isLoading || (enabled && probe.isLoading),
    grant,
    isGranting: grantMutation.isPending,
    error: session.error ?? grantMutation.error ?? probe.error,
  };
}

function selectorFromAbi(name: "addMargin" | "removeMargin"): Hex {
  const fragment = (accountLayerAbi as Abi).find((item) => item.type === "function" && item.name === name) as
    | AbiFunction
    | undefined;
  if (!fragment) throw new Error(`Selector lookup failed: "${name}" not in AccountLayer ABI.`);
  return toFunctionSelector(fragment);
}
