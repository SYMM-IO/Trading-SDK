import { isExpressWithdrawPayoutComplete, type ExpressWithdrawStatus } from "@symmio/trading-core";

interface ExpressWithdrawStatusQuery {
  state: { data?: ExpressWithdrawStatus };
}

/** Shared polling policy for single- and multi-request Express status hooks. @internal */
export function getExpressWithdrawStatusRefetchInterval(query: ExpressWithdrawStatusQuery): number | false {
  const status = query.state.data;
  if (!status) return 3_000;
  if (isExpressWithdrawPayoutComplete(status)) return false;
  if (
    status.onChain.status === "CANCELLED" ||
    status.onChain.status === "SUSPENDED" ||
    status.local.status === "FAILED" ||
    status.local.status === "CANCELLED" ||
    status.local.status === "SUSPENDED"
  ) {
    return false;
  }
  return 3_000;
}
