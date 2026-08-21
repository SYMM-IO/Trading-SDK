import { WithdrawStatus } from "@symmio/trading-core";

/** Human label plus a tier-2 colour token for each on-chain withdraw status. */
export const WITHDRAW_STATUS_STYLES: Record<WithdrawStatus, { label: string; color: string }> = {
  [WithdrawStatus.PENDING]: { label: "Cooling down", color: "var(--state-pending)" },
  [WithdrawStatus.PROVIDER_ACCEPTED]: { label: "Accepted", color: "var(--state-locked)" },
  [WithdrawStatus.PROVIDER_REJECTED]: { label: "Rejected", color: "var(--state-liquidated)" },
  [WithdrawStatus.COMPLETED]: { label: "Completed", color: "var(--state-closed)" },
  [WithdrawStatus.CANCEL_REQUESTED]: { label: "Cancelling", color: "var(--state-cancel-pending)" },
  [WithdrawStatus.CANCELLED]: { label: "Cancelled", color: "var(--state-canceled)" },
  [WithdrawStatus.SUSPENDED]: { label: "Suspended", color: "var(--state-liquidated)" },
};

/**
 * Format a future cooldown as a countdown.
 *
 * Withdrawals mature on a wall-clock deadline, so "in 3h 40m" is the only
 * reading that tells a user whether to wait or come back tomorrow.
 */
export function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "ready";
  const minutes = Math.ceil(secondsRemaining / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest > 0 ? `in ${hours}h ${rest}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}
