"use client";

import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { ReceiptRow } from "@/components/value";
import { useWriteToast, type WriteToastOptions } from "@/features/portfolio/use-write-toast";
import { useCancelWithdraw } from "@symmio/trading-react";
import { useState, type ReactElement } from "react";
import { WarnGlyph } from "./listing-chips";
import { useListingSession } from "./listing-session";
import { ListingSignIn } from "./listing-sign-in";
import { POOLS_CHAIN_ID } from "./pools-deployment";

export interface CancelWithdrawActionProps {
  /**
   * The queued withdrawal to drop: the `transactionId` of a row whose type is
   * `WITHDRAW` and whose status is still `PENDING`.
   *
   * Nothing else identifies it. The service takes no pool, no wallet and no
   * amount on this endpoint — the id alone is the whole request — which is why
   * the confirm sheet prints it rather than a friendlier description it would
   * have to invent.
   */
  withdrawId: string;
  /** Inert trigger, for a row the caller knows cannot be acted on yet. */
  disabled?: boolean;
}

/**
 * Cancel one queued LP withdrawal, behind a confirm step.
 *
 * ## Why this is not a one-click button
 *
 * A queued withdrawal is the reader's own money mid-flight, and this is the
 * only control in the Pools surface that destroys a request they already made.
 * Every other write here adds something — a listing, a deposit address, a
 * withdrawal — so a misfire costs a retry. A misfire on this one costs the
 * reader their place in the withdrawal queue: re-queueing is a *new* request
 * that starts at the back. That asymmetry is what earns the sheet.
 *
 * ## Why the toast carries the whole outcome
 *
 * There is no success receipt to render. `useCancelWithdraw` invalidates
 * `getPoolTransactions`, `getUserTransactions` and `getUserProfit`, so the row
 * this control sits on refetches and stops being pending — usually by leaving
 * the table entirely, taking this component with it. Anything the service said
 * has to be said before that happens, so the service's own word for the result
 * is written into the toast body rather than into the UI it would outlive.
 *
 * This is a REST call authorised by the listing session's bearer token, not a
 * transaction: nothing is signed and nothing is broadcast, so there is no chain
 * gate here. The only rung that needs the wallet on the pools chain is SIWE,
 * and the sheet offers it when the session is missing rather than presenting a
 * dead button.
 */
export function CancelWithdrawAction({ withdrawId, disabled = false }: CancelWithdrawActionProps): ReactElement {
  const { accessToken, isSignedIn } = useListingSession();
  const runWrite = useWriteToast();
  const cancel = useCancelWithdraw();

  const [open, setOpen] = useState(false);

  const onConfirm = () => {
    /* The options object is filled in from inside the write on purpose.
       `runWrite` reads `body` off it *after* awaiting the run, so the receipt —
       which does not exist until the DELETE resolves — can still reach the
       toast. It is the only surface left: by the time this lands the row is
       being refetched out from under the component. */
    const toast: WriteToastOptions = {
      pending: "Cancelling withdrawal…",
      success: "Withdrawal cancelled",
      body: "The queued shares are back in your available balance.",
      tone: "warn",
      failure: "Withdrawal not cancelled",
    };

    void runWrite(toast, async () => {
      const receipt = await cancel.mutateAsync({
        accessToken,
        withdrawId,
        /* Named explicitly: the mutation would otherwise default to the
           connected chain, and the listing backend only exists on this one. */
        chainId: POOLS_CHAIN_ID,
      });

      /* Printed exactly as the service said it. `PoolCancelWithdrawResult.
         status` is a raw string whose wire enum is a **superset** of
         `PoolTransactionStatus`, so mapping it through the SDK's enum would
         either drop a state the SDK does not name or relabel it as one it
         does. */
      toast.body = `The service reports this withdrawal as “${receipt.status}”. The queued shares are back in your available balance.`;
      setOpen(false);
    });
  };

  return (
    <>
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        Cancel
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Listing service"
        title="Cancel this withdrawal"
        footer={
          isSignedIn ? (
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="lg"
                className="flex-1"
                loading={cancel.isPending}
                disabled={accessToken.length === 0}
                onClick={onConfirm}
              >
                Cancel the withdrawal
              </Button>
              <Button variant="ghost" size="lg" disabled={cancel.isPending} onClick={() => setOpen(false)}>
                Keep it queued
              </Button>
            </div>
          ) : (
            /* Signed out is a rung, not a refusal. The row is visible to anyone
               with the pool open — the token is what proves the queue entry is
               theirs — so the sheet offers the signature instead of showing a
               disabled button with no way forward. */
            <div className="flex flex-col items-center gap-2">
              <ListingSignIn variant="inline" label="Sign in to cancel it" />
              <p className="max-w-[46ch] text-center text-2xs text-fg-3">
                The service identifies the owner of a queued withdrawal by signature, so it cannot act on this one until
                you sign.
              </p>
            </div>
          )
        }
      >
        <p className="text-sm leading-relaxed text-fg-2">
          The shares go straight back into your pool position. Nothing has left the pool yet — a queued withdrawal is
          collateral the backend has set aside, not a transfer in flight — so this restores your available LP balance
          rather than reversing anything on chain.
        </p>

        <div className="flex flex-col">
          <ReceiptRow
            label="Withdrawal id"
            value={<span className="font-mono text-2xs break-all text-fg-1">{withdrawId}</span>}
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-md border border-[var(--warn-500)]/35 bg-warn-bg px-3 py-2.5">
          <WarnGlyph className="mt-0.5 size-3.5 shrink-0 text-warn" />
          <div className="flex min-w-0 flex-col gap-1.5 text-sm leading-relaxed text-fg-2">
            <p>
              There is no undo. Wanting the withdrawal back means queueing a new one, and a new request joins the queue
              at the back rather than reclaiming this one’s place in it.
            </p>
            <p>
              A withdrawal the backend has already settled is no longer cancellable. The service rejects that outright,
              and the row stays exactly as it is.
            </p>
          </div>
        </div>

        {/* The toast says this too, but a toast is gone in six seconds and the
            sheet is still open — a reader who is about to press the button
            again needs the reason in front of them, not behind them. */}
        {cancel.error ? (
          <p className="text-sm text-short">
            The service refused it: <span className="font-mono text-2xs">{cancel.error.message}</span>
          </p>
        ) : null}
      </Modal>
    </>
  );
}
