import type { ExpressWithdrawStatus } from "./types";

/**
 * Test whether the receiver has been paid according to provider semantics.
 *
 * `STANDARD` deliberately remains incomplete at `FINALIZED`: Core has released
 * funds, but the provider still has to forward them and reach `PROCESSED`.
 *
 * @param status - Combined service/on-chain status.
 * @returns Whether receiver payout is complete.
 */
export function isExpressWithdrawPayoutComplete(status: ExpressWithdrawStatus): boolean {
  if (status.onChain.optionType === "STANDARD") return status.onChain.status === "PROCESSED";
  return status.onChain.status === "PROCESSED" || status.onChain.status === "FINALIZED";
}
