import { classifyGaslessFailure, type GaslessFailureReason } from "@symmio/trading-core";

const FAILURE_MESSAGES: Record<GaslessFailureReason, string> = {
  "payer-balance": "The paying sub-account cannot cover the fee. Deposit collateral; allowance alone is not balance.",
  "fee-allowance": "The operational-fee allowance is too low. Approve a bounded budget, then retry.",
  "free-quota": "The daily free-operation quota is spent. Wait for the UTC reset or use a funded payer.",
  "fee-limit": "The deployment's fee policy refused this request.",
  "failed-operation": "One call reverted. The batch is atomic, so none of it executed.",
  "nonce-or-deadline": "The signature is stale. Rebuild it with a fresh nonce; never replay the old payload.",
  "deposit-below-minimum": "The deposit address is below its settlement minimum, or the transfer is not visible yet.",
  "deposit-not-above-fees": "The deposit does not cover both the settlement and wallet-creation fees.",
  "idempotency-conflict": "That retry key belongs to another workflow. Reconcile the original request.",
  "client-schema": "The gateway rejected the request shape. This is a client/configuration problem.",
  "rate-limited": "The gateway rate-limited this client. Back off before retrying.",
  unauthorized: "This deployment does not allow the configured gateway authentication.",
  forbidden: "The gateway refused this client or protocol instance.",
  "unknown-instance": "The gateway does not serve this protocol instance. Check deployment pairing.",
  "gateway-unavailable": "The gateway did not accept the request. Retrying later is safe.",
  "submit-unconfirmed":
    "Submission is ambiguous and may already be executing. Do not repeat the intent or use wallet fallback.",
  "simulation-reverted": "Gateway simulation reverted. Correct the action before signing again.",
  unknown: "The gasless operation failed.",
};

/** A concise terminal-safe diagnosis with an actionable recovery. */
export function gaslessFailureMessage(error: unknown): string {
  const reason = classifyGaslessFailure(error);
  if (reason !== "unknown") return FAILURE_MESSAGES[reason];
  return error instanceof Error && error.message.trim() ? error.message : FAILURE_MESSAGES.unknown;
}

/** SDK/vendor code when one is structurally available. */
export function gaslessFailureCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
