import type { ExpressWithdrawOption } from "./types";

/**
 * Test whether a signed Express option is past its service deadline.
 *
 * @param option - Option carrying a Unix-seconds deadline.
 * @param nowSeconds - Clock override for deterministic callers/tests.
 * @returns `true` when the option must be discarded and refreshed.
 */
export function isExpressWithdrawOptionExpired(
  option: Pick<ExpressWithdrawOption, "deadline">,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  return nowSeconds > option.deadline;
}
