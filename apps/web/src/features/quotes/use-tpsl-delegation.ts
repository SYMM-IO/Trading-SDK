"use client";

import {
  INSTANT_TRADE_REQUIRED_SELECTORS,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  useGrantDelegation,
  useIsDelegationActive,
  useSymmioConfig,
} from "@symmio/trading-react";
import { useCallback, useState } from "react";
import { zeroAddress, type Address } from "viem";

/** One year — matches the instant-open flow's delegation lifetime. */
const DELEGATION_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Value returned by {@link useTpSlDelegation}. */
export interface UseTpSlDelegationResult {
  /** `true` when both the session key and the COH wallet are delegated for this sub-account. */
  ready: boolean;
  /** `true` while the on-chain delegation reads are loading. */
  isLoading: boolean;
  /** `true` while an enable transaction is in flight. */
  isEnabling: boolean;
  /** `true` when no session key exists yet — delegation cannot be granted until one does. */
  needsSessionKey: boolean;
  /** Grant both delegations (session key + COH wallet). No-op without a session key or COH wallet. */
  enable: () => Promise<void>;
  /** Normalized enable error, when the last attempt failed. */
  error: Error | null;
}

/**
 * The on-chain prerequisite for setting TP/SL on a merged position.
 *
 * The v5 conditional-order handler recovers the EIP-712 signer and only accepts
 * it when that address is a **delegated session key** for the sub-account; it
 * separately needs the **COH wallet** delegated so it can fire the close when a
 * trigger hits. So both must be granted before any exit can be written — the
 * same two spenders the reference app requires. Delegating only the COH wallet
 * (or nothing) is exactly what produces the handler's 401.
 *
 * @param parameters.subAccount - The sub-account whose positions are being managed.
 * @param parameters.sessionKey - The session key that will sign the orders.
 * @returns Readiness plus a one-call {@link UseTpSlDelegationResult.enable} that grants both.
 */
export function useTpSlDelegation(parameters: { subAccount?: Address; sessionKey?: Address }): UseTpSlDelegationResult {
  const { subAccount, sessionKey } = parameters;
  const config = useSymmioConfig();
  const cohWallet = config.getChainConfig().solver.tpsl?.cohWalletAddress;

  const sessionEnabled = Boolean(subAccount && sessionKey);
  const cohEnabled = Boolean(subAccount && cohWallet);

  // The close selector stands in for the whole instant-trade set — the enable
  // path grants all three at once, so any one being active means all are.
  const sessionDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: sessionKey ?? zeroAddress,
    selector: REQUEST_TO_CLOSE_POSITION_SELECTOR,
    query: { enabled: sessionEnabled },
  });
  const cohDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: cohWallet ?? zeroAddress,
    selector: REQUEST_TO_CLOSE_POSITION_SELECTOR,
    query: { enabled: cohEnabled },
  });

  const grant = useGrantDelegation();
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const enable = useCallback(async () => {
    if (!subAccount || !sessionKey || !cohWallet) return;
    setIsEnabling(true);
    setError(null);
    try {
      const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS);
      // Sequential: each grant is its own signed transaction from the connected
      // wallet, so serializing avoids two simultaneous prompts.
      for (const delegatedSigner of [sessionKey, cohWallet]) {
        await grant.mutateAsync({
          account: { addr: subAccount, isPartyB: false },
          delegatedSigner,
          selectors: INSTANT_TRADE_REQUIRED_SELECTORS,
          expiryTimestamp,
        });
      }
      await Promise.all([sessionDelegation.refetch(), cohDelegation.refetch()]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsEnabling(false);
    }
  }, [subAccount, sessionKey, cohWallet, grant, sessionDelegation, cohDelegation]);

  return {
    ready: sessionDelegation.data === true && cohDelegation.data === true,
    isLoading: (sessionEnabled && sessionDelegation.isLoading) || (cohEnabled && cohDelegation.isLoading),
    isEnabling,
    needsSessionKey: !sessionKey,
    enable,
    error,
  };
}
