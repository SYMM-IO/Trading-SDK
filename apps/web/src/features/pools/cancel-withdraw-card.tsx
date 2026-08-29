"use client";

import { ResultError, ResultNote } from "@/components/result";
import { PoolTransactionStatus, PoolTransactionType } from "@symmio/trading-core";
import { useCancelWithdraw, usePoolTransactions } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useAccount } from "wagmi";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { quantity, timestamp, usd } from "./detail-tables/shared";
import { useListingAuth } from "./listing-auth-context";
import { usePoolScope } from "./pool-scope";
import { SignInNote } from "./sign-in-note";

/**
 * Cancel withdrawal — remove a queued LP withdrawal from a pool before it
 * settles.
 *
 * Lists the connected wallet's still-`PENDING` withdrawals for the pool picked in
 * the section's shared picker ({@link usePoolScope}), read via
 * {@link usePoolTransactions}, and offers a Cancel on each. Canceling
 * ({@link useCancelWithdraw}) `DELETE`s the withdrawal by its `transactionId`;
 * on success the shares return to the user's available balance, so the list
 * refetches.
 *
 * The bearer token comes from the shared {@link useListingAuth} session, so the
 * user signs in **once**. Enigma-only, mirroring the other Listing-session cards.
 */
export function CancelWithdrawCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken } = useListingAuth();
  const { address: connectedAddress } = useAccount();
  const { contractAddress } = usePoolScope();

  const signedIn = accessToken !== null;
  const ready = signedIn && contractAddress.length > 0 && connectedAddress !== undefined;

  const transactions = usePoolTransactions({
    marketAddress: contractAddress,
    walletAddress: connectedAddress,
    query: { enabled: ready },
  });

  const cancel = useCancelWithdraw();

  const pending = (transactions.data?.items ?? []).filter(
    (tx) => tx.type === PoolTransactionType.WITHDRAW && tx.status === PoolTransactionStatus.PENDING,
  );

  function onCancel(withdrawId: string) {
    if (accessToken === null) return;
    // No onSuccess refetch here — useCancelWithdraw invalidates every
    // getPoolTransactions query at the react level, so this list refetches itself.
    cancel.mutate({ accessToken, withdrawId });
  }

  return (
    <MethodCard
      testId="method-cancelWithdraw"
      name="cancelWithdraw"
      mutability="nonpayable"
      description="Cancel withdrawal — remove one of your queued LP withdrawals before it settles. Sign in once, pick a pool above; your pending withdrawals list here with a Cancel each. Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="cancel-withdraw-gate">Switch to Enigma (HyperEVM) to cancel a withdrawal.</ResultNote>
      ) : !signedIn ? (
        <SignInNote testId="cancel-withdraw-idle" buttonTestId="cancel-withdraw-sign-in">
          Sign in to see and cancel your pending withdrawals.
        </SignInNote>
      ) : contractAddress.length === 0 ? (
        <ResultNote testId="cancel-withdraw-no-pool">Pick a pool above to see your pending withdrawals.</ResultNote>
      ) : cancel.error ? (
        <ResultError kind={cancel.error.kind} message={cancel.error.message} testId="cancel-withdraw-error" />
      ) : transactions.error ? (
        <ResultError
          kind={transactions.error.kind}
          message={transactions.error.message}
          testId="cancel-withdraw-list-error"
        />
      ) : transactions.isPending ? (
        <ResultNote testId="cancel-withdraw-loading" loading>
          Loading your pending withdrawals…
        </ResultNote>
      ) : pending.length === 0 ? (
        <ResultNote testId="cancel-withdraw-empty">No pending withdrawals to cancel.</ResultNote>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="cancel-withdraw-list">
          {pending.map((tx) => {
            const busy = cancel.isPending && cancel.variables?.withdrawId === tx.transactionId;
            return (
              <li
                key={tx.transactionId}
                className="border-border/60 flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-sm">{quantity(tx.amount)} LP</span>
                  <span className="text-muted-foreground text-xs">
                    {usd(tx.usdcAmount)} · {timestamp(tx.time)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cancel.isPending}
                  onClick={() => onCancel(tx.transactionId)}
                  data-testid={`cancel-withdraw-${tx.transactionId}`}
                >
                  {busy ? (
                    <>
                      <Spinner className="size-4" /> Canceling…
                    </>
                  ) : (
                    "Cancel"
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </MethodCard>
  );
}
