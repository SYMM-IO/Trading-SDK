"use client";

import { ResultError } from "@/components/result";
import {
  classifyGaslessFailure,
  parseGaslessErrorDetail,
  SymmioRequestError,
  type GaslessFailureReason,
} from "@symmio/trading-react";
import { JsonView } from "@symmio/ui/components/json-view";
import type { ReactNode } from "react";

/**
 * One line per failure reason: what went wrong and what the user does next.
 * `classifyGaslessFailure` already collapses the vendor codes, the decoded
 * reverts and the HTTP statuses into these, so the card never has to read a
 * response body to say something useful.
 */
const REASON_MESSAGE: Record<GaslessFailureReason, string> = {
  "payer-balance":
    "The billing sub-account cannot cover the fee. Top up its SYMMIO collateral — raising the allowance alone does nothing.",
  "fee-allowance":
    "The payer’s operational-fee allowance is too low for this charge. Approve more on the allowance card, then retry.",
  "free-quota": "The daily free-operations quota is spent. Wait for the UTC reset, or pay the fee from a funded payer.",
  "fee-limit": "The fee policy refused the request.",
  "failed-operation": "One call in the batch reverted. The batch is atomic, so nothing executed.",
  "nonce-or-deadline":
    "The signature is stale — its nonce or deadline no longer applies. Rebuild and sign again; never resend the old payload.",
  "deposit-below-minimum":
    "The deposit address holds less than the settlement minimum, or the transfer is not visible on-chain yet.",
  "deposit-not-above-fees": "The balance clears the minimum but not the deposit and wallet-creation fees.",
  "idempotency-conflict":
    "That idempotency key already belongs to a different request. Reconcile the original by its request id instead of resubmitting.",
  "client-schema": "The gateway rejected the payload’s shape. That is a client bug, not a user error.",
  "rate-limited":
    "The gateway rate-limited this client (anonymous access is capped per IP and instance). Back off, then retry.",
  unauthorized: "The gateway refused the request: this deployment does not serve it anonymously.",
  forbidden: "The gateway refused this request.",
  "unknown-instance": "The gateway does not serve this protocol instance. Check the deployment wiring.",
  "gateway-unavailable": "The gateway did not answer. Nothing reached the service, so retrying is safe.",
  "submit-unconfirmed":
    "The submit was never confirmed and the request may already be executing. Reconcile it by its request id — do not re-run the intent.",
  "simulation-reverted": "The service simulated the batch and it reverted. Rebuild the call and sign again.",
  unknown: "The request failed.",
};

/**
 * The short, actionable line for a gasless failure.
 *
 * @param error - Anything thrown by a gasless hook.
 * @returns The sentence to show the user.
 */
export function gaslessFailureMessage(error: unknown): string {
  const reason = classifyGaslessFailure(error);
  return reason === "unknown" ? unclassifiedMessage(error) : REASON_MESSAGE[reason];
}

/**
 * The text for a failure the classifier cannot name. Those never reached the
 * gateway — a contract read, an RPC outage, a typed SDK guard such as
 * `GASLESS_WALLET_UNAVAILABLE` — so the error's own message is the only thing
 * that says what happened, and a generic sentence would bury it.
 */
function unclassifiedMessage(error: unknown): string {
  const request = error instanceof SymmioRequestError ? error : null;
  const text = request?.shortMessage ?? request?.reason ?? (error instanceof Error ? error.message : "");
  return text.trim().length > 0 ? text : REASON_MESSAGE.unknown;
}

/** The chip for an unclassified failure: the SDK code, else its error kind. */
function unclassifiedLabel(error: unknown): string {
  const request = error instanceof SymmioRequestError ? error : null;
  return request?.code ?? request?.kind ?? "unknown";
}

interface Props {
  /** The error a gasless mutation or query rejected with. */
  error: unknown;
  /**
   * Replaces the classified sentence, for the failures a card understands
   * better than the classifier does — an accepted-but-mismatched settlement is
   * an HTTP `202`, so nothing in the classification describes it.
   */
  headline?: ReactNode;
  /** Replaces the reason chip. Pass it whenever `headline` is set. */
  label?: ReactNode;
  /** Extra context rendered under the headline (e.g. the accepted request id). */
  children?: ReactNode;
  testId?: string;
}

/**
 * Failure panel for every gasless card: the classified reason as a chip, one
 * sentence the user can act on, and the raw diagnosis folded away.
 *
 * The rejection body is where the cause actually lives (`detail.code`, a
 * decoded revert, the failing batch index) while `error.message` carries only
 * the HTTP status — but dumping that body as the headline makes every failure
 * unreadable. So the headline is the classification and the body is one click
 * away, in a JSON tree rather than a `<pre>` blob.
 *
 * A failure the classifier cannot name never reached the gateway, so there is
 * no vendor detail to collapse: the error's own message becomes the headline
 * and its SDK code the chip, and only a failure with no text at all falls back
 * to the generic sentence.
 */
export function GaslessFailureNote({ error, headline, label, children, testId }: Props) {
  const reason = classifyGaslessFailure(error);
  const request = error instanceof SymmioRequestError ? error : null;
  const unclassified = reason === "unknown";
  const diagnostics = {
    reason,
    kind: request?.kind,
    code: request?.code,
    status: request?.status,
    message: error instanceof Error ? error.message : String(error),
    detail: parseGaslessErrorDetail(error),
    responseData: request?.responseData,
  };

  return (
    <ResultError
      kind={label ?? (unclassified ? unclassifiedLabel(error) : reason)}
      testId={testId}
      message={
        <div className="flex flex-col gap-2">
          <span>{headline ?? (unclassified ? unclassifiedMessage(error) : REASON_MESSAGE[reason])}</span>
          {children}
          <details className="group">
            <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs select-none">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="size-3 transition-transform group-open:rotate-90"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              Diagnostics
            </summary>
            <div className="mt-2">
              <JsonView data={diagnostics} defaultExpandedDepth={2} />
            </div>
          </details>
        </div>
      }
    />
  );
}
