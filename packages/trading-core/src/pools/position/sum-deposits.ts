import type { UserTransaction } from "../types";
/** Internal cumulative history. Amounts are already normalized to 18 decimals. */
export function sumPoolDepositHistory(deposits: readonly Pick<UserTransaction, "amount" | "status">[]) {
  const history = { pending: 0n, transferred: 0n, refund: 0n, rejected: 0n, success: 0n };
  for (const { amount, status } of deposits) {
    switch (status as string) {
      case "waiting":
      case "pending":
        history.pending += amount;
        break;
      case "deposited":
      case "transferred":
        history.transferred += amount;
        break;
      case "refund":
      case "refound":
        history.refund += amount;
        break;
      case "rejected":
        history.rejected += amount;
        break;
      case "success":
        history.success += amount;
        break;
    }
  }
  return history;
}
