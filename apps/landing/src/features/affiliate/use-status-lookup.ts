"use client";

import { AffiliateState } from "@symmio/trading-core";
import {
  useAffiliateState,
  useCancelRegistration,
  useConnectWallet,
  useSwitchToSymmioChain,
  useWalletAccount,
} from "@symmio/trading-react";
import { useEffect, useState } from "react";
import { isAddress, type Address, type Hash } from "viem";
import { hyperEvm } from "wagmi/chains";
import type { CancellationPayload } from "./registration-utils";

/**
 * The single adaptive primary action the status card offers, or `null` when
 * there is nothing actionable (still typing, or a non-pending state).
 *
 * - `connect-to-cancel` / `switch` / `cancel` — gates on the way to cancelling a
 *   still-`PENDING` registration.
 */
export type StatusPrimary = "connect-to-cancel" | "switch" | "cancel" | null;

/**
 * Drives the "Check status" surface: takes a pasted affiliate address, live-polls
 * its lifecycle state, and exposes a state-gated cancel. Cancel is only ever
 * reachable while the registration is `PENDING` — the contract reverts once it is
 * active or paused — so the returned {@link StatusPrimary} never offers it otherwise.
 *
 * Lookup is by address only: the affiliate address is a deterministic hash of the
 * registrant wallet and the exact name, which the chain cannot reverse or
 * enumerate, so the registrant is asked to save the address at registration time.
 */
export function useStatusLookup() {
  const [addressInput, setAddressInput] = useState("");

  const wallet = useWalletAccount();
  const { connectors, connect, status: connectStatus, error: connectError } = useConnectWallet();
  const { switchChain, status: switchStatus } = useSwitchToSymmioChain();

  const trimmedAddress = addressInput.trim();
  const pastedIsValid = isAddress(trimmedAddress);

  /** The affiliate address under inspection, or `undefined` while unresolved. */
  const affiliate: Address | undefined = pastedIsValid ? (trimmedAddress as Address) : undefined;

  const stateQuery = useAffiliateState({
    affiliate,
    query: {
      /** Poll only while the state can still change; terminal states stop it. */
      refetchInterval: (query) =>
        query.state.data === undefined || query.state.data === AffiliateState.PENDING ? 12_000 : false,
    },
  });
  const state = stateQuery.data;

  const cancelMutation = useCancelRegistration({ waitForReceipt: true });
  const { reset: resetCancel } = cancelMutation;

  /** Clear a prior cancel result whenever the affiliate under inspection changes. */
  useEffect(() => {
    resetCancel();
  }, [affiliate, resetCancel]);

  /**
   * Gate on the just-cancelled result too, not only the cached state: the cancel
   * mutation settles before its invalidated `getAffiliateState` refetch lands, so
   * a bare `state === PENDING` check would briefly re-offer the cancel button
   * under the success banner (and let a fast double-click re-fire a now-reverting
   * cancel). `isSuccess` retires it the instant the transaction confirms.
   */
  const canCancel = state === AffiliateState.PENDING && !cancelMutation.isSuccess;

  let primary: StatusPrimary = null;
  if (canCancel) {
    if (!wallet.isConnected) primary = "connect-to-cancel";
    else if (!wallet.isOnExpectedChain) primary = "switch";
    else primary = "cancel";
  }

  const isBusy = cancelMutation.isPending || switchStatus === "pending" || connectStatus === "pending";

  /**
   * Tell the team a still-`PENDING` registration was cancelled, mirroring the
   * registration notify call. Fire-and-forget: a failure never blocks the
   * on-chain cancel — the success banner already reflects the confirmed tx.
   */
  async function sendCancellationNotification(affiliate: Address, canceller: Address, txHash: Hash) {
    try {
      const payload: CancellationPayload = {
        kind: "cancellation",
        affiliate,
        canceller,
        chainId: wallet.chainId ?? hyperEvm.id,
        txHash,
      };
      await fetch("/api/affiliate-notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* Best-effort notification; a failure never blocks the on-chain cancel. */
    }
  }

  /** Run whatever the current {@link StatusPrimary} implies. */
  async function act() {
    if (primary === "connect-to-cancel") {
      const injected = connectors[0];
      if (injected) await connect(injected).catch(() => undefined);
      return;
    }
    if (primary === "switch") {
      await switchChain().catch(() => undefined);
      return;
    }
    if (primary === "cancel" && affiliate) {
      const res = await cancelMutation.mutateAsync({ affiliate }).catch(() => undefined);
      if (res && wallet.address) void sendCancellationNotification(affiliate, wallet.address, res.hash);
    }
  }

  /** Validation message for the address field once the user has typed something. */
  const addressError = trimmedAddress !== "" && !pastedIsValid ? "Enter a valid affiliate address." : undefined;

  return {
    addressInput,
    setAddressInput,
    addressError,
    wallet,
    affiliate,
    state,
    /** True on the first read of a resolved affiliate, before any state is known. */
    isChecking: Boolean(affiliate) && stateQuery.isPending,
    stateError: stateQuery.error?.message,
    canCancel,
    primary,
    isBusy,
    connectError: connectError?.message,
    cancelError: cancelMutation.error?.message,
    cancelSuccess: cancelMutation.isSuccess,
    act,
  };
}

/** The shape returned by {@link useStatusLookup}, for prop typing. */
export type StatusLookupApi = ReturnType<typeof useStatusLookup>;
