"use client";

import type { FundingAccount } from "@/features/accounts/account-provider";
import { INSTANT_TRADE_REQUIRED_SELECTORS, REQUEST_TO_CLOSE_POSITION_SELECTOR } from "@symmio/trading-core";
import { useGrantDelegation, useIsDelegationActive, useSymmioConfig } from "@symmio/trading-react";
import { useCallback, useState } from "react";
import { zeroAddress, type Address } from "viem";
import { DELEGATION_TTL_SECONDS, useTradingDelegation } from "./use-trading-delegation";

export interface TpSlDelegation {
  /** The local key every conditional order is signed with. `null` until it loads. */
  sessionKey: Address | null;
  /** The handler's own wallet, which fires the close when a trigger hits. */
  handlerWallet: Address | undefined;
  /** True when both signers may close this account's positions. */
  isReady: boolean;
  /** True while either probe is in flight — distinct from "not granted". */
  isLoading: boolean;
  /** True when there is no session key yet, so nothing can be granted. */
  needsSessionKey: boolean;
  /** Grant whatever is still missing, in one call. Rejects as the wallet does. */
  grant: () => Promise<void>;
  isGranting: boolean;
  /** Why the last grant failed, if it did. */
  error: Error | null;
}

/**
 * Whether this sub-account has authorised **both** signers a conditional order
 * needs.
 *
 * A TP/SL order is two authorisations, not one. The trader signs the order with
 * the local **session key**, and the handler recovers that signature and only
 * accepts it if the key is a delegate of the sub-account — the same grant every
 * instant trade needs. But the handler also has to *act* when the trigger
 * fires, and it does that from its own COH wallet, which therefore needs
 * `requestToClosePosition` delegated to it as well.
 *
 * Miss the first and the handler answers 401 at submit. Miss the second and the
 * submit succeeds, the exit sits there looking live, and the close reverts
 * on-chain at the only moment it mattered. So both are a precondition of the
 * form, not of the fill.
 *
 * @param account The sub-account the exits would be written for.
 */
export function useTpSlDelegation(account: FundingAccount | undefined): TpSlDelegation {
  const trading = useTradingDelegation(account);
  const config = useSymmioConfig();
  const grantMutation = useGrantDelegation();
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const chainId = account?.deployment.chainId;
  const handlerWallet = resolveHandlerWallet(config, account);

  const probe = useIsDelegationActive({
    account: account?.address ?? zeroAddress,
    delegate: handlerWallet ?? zeroAddress,
    selector: REQUEST_TO_CLOSE_POSITION_SELECTOR,
    chainId,
    query: { enabled: Boolean(account && handlerWallet) },
  });

  const grant = useCallback(async () => {
    if (!account || !handlerWallet) return;
    setIsGranting(true);
    setError(null);
    try {
      /* Two separate transactions, deliberately serialized: each is signed by
         the connected wallet, and firing both at once means two prompts racing
         for the same nonce. */
      if (!trading.isActive) await trading.grantAsync();
      if (probe.data !== true) {
        await grantMutation.mutateAsync({
          account: { addr: account.address, isPartyB: false },
          delegatedSigner: handlerWallet,
          selectors: INSTANT_TRADE_REQUIRED_SELECTORS,
          expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
          chainId: account.deployment.chainId,
        });
      }
      await probe.refetch();
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      setError(failure);
      throw failure;
    } finally {
      setIsGranting(false);
    }
  }, [account, handlerWallet, trading, probe, grantMutation]);

  return {
    sessionKey: trading.sessionKey,
    handlerWallet,
    isReady: trading.isActive && probe.data === true,
    isLoading: trading.isLoading || (Boolean(account && handlerWallet) && probe.isLoading),
    needsSessionKey: trading.sessionKey === null,
    grant,
    isGranting: isGranting || trading.isGranting,
    error: error ?? trading.error,
  };
}

/**
 * The COH wallet for this account's deployment, or `undefined` when its solver
 * runs no conditional-order handler at all. Asked per deployment rather than
 * off the default chain — Prism holds two, and only one of them has a handler.
 */
function resolveHandlerWallet(
  config: ReturnType<typeof useSymmioConfig>,
  account: FundingAccount | undefined,
): Address | undefined {
  if (!account) return undefined;
  try {
    return config.getSolver({ chainId: account.deployment.chainId, solverId: account.deployment.solverId }).tpsl
      ?.cohWalletAddress;
  } catch {
    return undefined;
  }
}
