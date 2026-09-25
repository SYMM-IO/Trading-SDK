"use client";

import { Button } from "@/components/button";
import { CopyAction } from "@/components/detail-list";
import { useToast } from "@/components/toast";
import { shortenAddress } from "@/lib/format";
import type { ListingDepositChainId } from "@symmio/trading-core";
import { useRefundMarket, useRetryListing, useRetryListingInfo, useWalletAccount } from "@symmio/trading-react";
import { useState } from "react";
import { useListingSession } from "./listing-session";
import { ListingSignIn } from "./listing-sign-in";
import { POOLS_CHAIN_ID } from "./pools-deployment";

interface Props {
  address: string;
  chainId: ListingDepositChainId;
}

/** Retry-or-refund recovery controls for a rejected listing. */
export function ListingRecoveryActions({ address, chainId }: Props) {
  const session = useListingSession();
  const wallet = useWalletAccount();
  const toast = useToast();
  const [confirmRefund, setConfirmRefund] = useState(false);

  const info = useRetryListingInfo({
    accessToken: session.accessToken,
    tokenContractAddress: address,
    depositChain: chainId,
    chainId: POOLS_CHAIN_ID,
    query: {
      enabled: session.isSignedIn,
      refetchInterval: (query) => ((query.state.data?.remainingCooldownSeconds ?? 0) > 0 ? 1_000 : false),
    },
  });
  const retry = useRetryListing();
  const refund = useRefundMarket();

  const remaining = info.data?.remainingRetries ?? 0;
  const cooldown = info.data?.remainingCooldownSeconds ?? null;
  const canRetry = session.isSignedIn && remaining > 0 && (cooldown === null || cooldown === 0);

  async function retryListing() {
    if (!session.isSignedIn) {
      session.signIn();
      return;
    }
    if (!canRetry) return;
    const toastId = toast.push({ title: "Retrying listing", tone: "pending" });
    try {
      const result = await retry.mutateAsync({
        accessToken: session.accessToken,
        tokenContractAddress: address,
        depositChain: chainId,
        chainId: POOLS_CHAIN_ID,
      });
      toast.update(toastId, {
        title: "Listing retry submitted",
        body: `${result.remainingRetries} of ${result.retryLimit} retries remain.`,
        tone: "long",
      });
    } catch (error) {
      toast.update(toastId, {
        title: "Retry failed",
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  }

  async function refundListing() {
    if (!session.isSignedIn) {
      session.signIn();
      return;
    }
    if (!wallet.address) return;
    const toastId = toast.push({
      title: "Requesting refund",
      body: `Returning the rejected listing deposit to ${shortenAddress(wallet.address)}.`,
      tone: "pending",
    });
    try {
      const result = await refund.mutateAsync({
        accessToken: session.accessToken,
        marketAddress: address,
        depositChain: chainId,
        recipientAddress: wallet.address,
        chainId: POOLS_CHAIN_ID,
      });
      toast.update(toastId, {
        title: "Refund submitted",
        body: result.transactionHash,
        tone: "long",
      });
      setConfirmRefund(false);
    } catch (error) {
      toast.update(toastId, {
        title: "Refund failed",
        body: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-bg-2 p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-fg-0">Choose how to recover this listing</p>
          <p className="text-2xs text-fg-3">
            {session.isSignedIn
              ? info.data
                ? `${remaining} of ${info.data.retryLimit} retries remain${cooldown ? ` · available in ${cooldown}s` : ""}`
                : "Reading your retry allowance…"
              : "Sign once to read your retry allowance and act on this deposit."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.isSignedIn ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={retry.isPending}
                disabled={!canRetry || info.isLoading}
                onClick={() => void retryListing()}
              >
                Retry listing
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={!wallet.address}
                onClick={() => setConfirmRefund(true)}
              >
                Refund deposit
              </Button>
            </>
          ) : (
            <ListingSignIn variant="inline" label="Sign in to recover" />
          )}
        </div>
      </div>

      {confirmRefund && wallet.address ? (
        <div className="flex flex-col gap-2 border-t border-line-subtle pt-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm text-fg-2">
            Refund to <span className="font-mono text-fg-0">{shortenAddress(wallet.address)}</span>. This abandons the
            listing instead of retrying it.
          </p>
          <CopyAction value={wallet.address} label="refund recipient" />
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRefund(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            loading={refund.isPending}
            onClick={() => void refundListing()}
          >
            Confirm refund
          </Button>
        </div>
      ) : null}

      {info.error ? <p className="text-2xs text-short">{info.error.message}</p> : null}
    </div>
  );
}
