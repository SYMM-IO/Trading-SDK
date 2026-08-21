"use client";

import type { FundingAccount } from "@/features/accounts/account-provider";
import { useSessionKey } from "@/features/session-key/use-session-key";
import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  INSTANT_TRADE_REQUIRED_SELECTORS,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
  SubAccountIsolationType,
} from "@symmio/trading-core";
import { useDelegationExpiry, useGrantDelegation, useIsDelegationActive } from "@symmio/trading-react";
import { useCallback, useMemo } from "react";
import { zeroAddress, type Address } from "viem";

/** How long a grant lasts. Long enough that a returning trader never re-signs. */
export const DELEGATION_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Re-prompt this far ahead of expiry — an expired grant reverts like a missing one. */
const RENEW_WINDOW_SECONDS = 3 * 24 * 60 * 60;

/** One selector's delegation state, so a partial grant is legible. */
export interface DelegationSelector {
  /** What the selector authorises, in the user's terms. */
  label: string;
  isActive: boolean | undefined;
  isLoading: boolean;
  /** False when this deployment's margin model never calls the selector. */
  isRequired: boolean;
}

export interface TradingDelegation {
  /** The signer instant trades are signed by. `null` until the key loads. */
  sessionKey: Address | null;
  /** True when every selector this account needs is granted and unexpired. */
  isActive: boolean;
  /** True while any probe is in flight — distinct from "not granted". */
  isLoading: boolean;
  /** True when a grant exists but is close enough to expiry to re-sign now. */
  isExpiringSoon: boolean;
  /** Unix seconds the current grant lapses, when there is one. */
  expiresAt: bigint | undefined;
  /** Per-selector detail, in grant order. */
  selectors: readonly DelegationSelector[];
  /** Grant every required selector in one transaction. Fire-and-forget. */
  grant: () => void;
  /** The same grant, awaitable — for a flow that wraps it in its own feedback. Rejects as the wallet does. */
  grantAsync: () => Promise<void>;
  isGranting: boolean;
  /** Why the last grant failed, if it did. */
  grantError: Error | null;
  /** Why the delegation could not be read, if it could not. */
  probeError: Error | null;
  /** `grantError`, else `probeError` — for a caller that shows one line. */
  error: Error | null;
}

/**
 * Whether this sub-account has authorised the session key to trade for it.
 *
 * Instant trading signs orders with a **local session key**, not the wallet, so
 * the order never opens a wallet popup. The contract only accepts that
 * signature if the sub-account has delegated the matching function selector to
 * the key — and it checks *at execution time*, after the solver has already
 * accepted the request. A missing delegation therefore does not fail loudly; it
 * fails on-chain, silently, once the spinner has stopped. The SDK docs call this
 * the single most common instant-trading bug.
 *
 * So the check is a precondition on **every** session-key write, not just the
 * open form: a position from a previous session still renders in the blotter,
 * and its Close is signed by the same key. Rotating the key drops all three
 * grants at once, which is why "I could trade a minute ago" proves nothing.
 *
 * ## Why the required set differs per deployment
 *
 * `INSTANT_TRADE_REQUIRED_SELECTORS` is the lowcap superset. A cross-margin
 * sub-account trades directly and never calls `addMarginToNextVA`, so requiring
 * that selector would deadlock a majors trader whose grant legitimately omits
 * it. The requirement follows the sub-account's isolation type — the same rule
 * the SDK applies to the margin model itself.
 *
 * @param account The sub-account a trade would settle against.
 */
export function useTradingDelegation(account: FundingAccount | undefined): TradingDelegation {
  const { address: sessionKey } = useSessionKey();

  const chainId = account?.deployment.chainId;
  const subAccount = account?.address;
  const isCrossMargin = account?.detail.isolationType === SubAccountIsolationType.CUSTOM;

  const enabled = Boolean(subAccount && sessionKey && chainId);
  const probe = { account: subAccount ?? zeroAddress, delegate: sessionKey ?? zeroAddress, chainId };

  const sendQuote = useIsDelegationActive({
    ...probe,
    selector: SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
    query: { enabled },
  });
  const closePosition = useIsDelegationActive({
    ...probe,
    selector: REQUEST_TO_CLOSE_POSITION_SELECTOR,
    query: { enabled },
  });
  const addMargin = useIsDelegationActive({
    ...probe,
    selector: ADD_MARGIN_TO_NEXT_VA_SELECTOR,
    query: { enabled: enabled && !isCrossMargin },
  });

  /* Expiry is read off the open selector: the three are granted in one
     transaction, so they share a timestamp. */
  const expiry = useDelegationExpiry({
    ...probe,
    selector: SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
    query: { enabled },
  });

  const { mutate, mutateAsync, isPending: isGranting, error: grantError } = useGrantDelegation();

  const grantVariables = useCallback(() => {
    if (!subAccount || !sessionKey || !chainId) return undefined;
    return {
      account: { addr: subAccount, isPartyB: false },
      delegatedSigner: sessionKey,
      /* Granting the full set on a cross-margin account is harmless — the extra
         selector is simply never called — and it keeps one code path. */
      selectors: INSTANT_TRADE_REQUIRED_SELECTORS,
      expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
      chainId,
    };
  }, [subAccount, sessionKey, chainId]);

  const grant = useCallback(() => {
    const variables = grantVariables();
    if (variables) mutate(variables);
  }, [mutate, grantVariables]);

  const grantAsync = useCallback(async () => {
    const variables = grantVariables();
    if (variables) await mutateAsync(variables);
  }, [mutateAsync, grantVariables]);

  return useMemo(() => {
    const selectors: DelegationSelector[] = [
      {
        label: "Open positions",
        isActive: sendQuote.data,
        isLoading: sendQuote.isLoading,
        isRequired: true,
      },
      {
        label: "Close positions",
        isActive: closePosition.data,
        isLoading: closePosition.isLoading,
        isRequired: true,
      },
      {
        label: "Top up position margin",
        isActive: addMargin.data,
        isLoading: addMargin.isLoading,
        isRequired: !isCrossMargin,
      },
    ];

    const required = selectors.filter((selector) => selector.isRequired);
    const expiresAt = expiry.data && expiry.data > 0n ? expiry.data : undefined;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const probeError = sendQuote.error ?? closePosition.error ?? (isCrossMargin ? null : addMargin.error) ?? null;

    return {
      sessionKey,
      isActive: enabled && required.every((selector) => selector.isActive === true),
      isLoading: enabled && required.some((selector) => selector.isLoading),
      isExpiringSoon: expiresAt !== undefined && expiresAt - now < BigInt(RENEW_WINDOW_SECONDS),
      expiresAt,
      selectors,
      grant,
      grantAsync,
      isGranting,
      grantError: grantError ?? null,
      probeError,
      error: grantError ?? probeError,
    };
  }, [
    sendQuote.data,
    sendQuote.isLoading,
    sendQuote.error,
    closePosition.data,
    closePosition.isLoading,
    closePosition.error,
    addMargin.data,
    addMargin.isLoading,
    addMargin.error,
    isCrossMargin,
    expiry.data,
    sessionKey,
    enabled,
    grant,
    grantAsync,
    isGranting,
    grantError,
  ]);
}
