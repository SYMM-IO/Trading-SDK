import { describe, expect, it } from "vitest";
import { isExpressWithdrawCancellable } from "./is-express-withdraw-cancellable";
import type { ExpressWithdrawOnChainStatus, ExpressWithdrawStatus } from "./types";

function status(
  optionType: ExpressWithdrawStatus["onChain"]["optionType"],
  onChainStatus: ExpressWithdrawStatus["onChain"]["status"],
): ExpressWithdrawStatus {
  return {
    onChain: {
      status: onChainStatus,
      optionType,
      expressAmount: 1n,
      acceptedAt: 0,
      finalizedAt: 0,
      cooldownEndTime: 0,
    },
    local: {
      status: "ACCEPTED",
      riskScore: null,
      riskChecked: false,
      lockTxHash: null,
      processTxHash: null,
      finalizeTxHash: null,
    },
  };
}

/** The provider's cancel rule for every on-chain status; only `ACCEPTED` approves. */
const CANCELLABLE: Record<ExpressWithdrawOnChainStatus, boolean> = {
  NONE: false,
  ACCEPTED: true,
  LOCKED: false,
  PROCESSED: false,
  FINALIZED: false,
  CANCELLED: false,
  SUSPENDED: false,
};

const CASES = (["WINDOWED", "STANDARD"] as const).flatMap((optionType) =>
  (Object.keys(CANCELLABLE) as ExpressWithdrawOnChainStatus[]).map((onChainStatus) => ({
    optionType,
    onChainStatus,
    expected: CANCELLABLE[onChainStatus],
  })),
);

describe("isExpressWithdrawCancellable", () => {
  it.each(CASES)("returns $expected for $optionType at $onChainStatus", ({ optionType, onChainStatus, expected }) => {
    expect(isExpressWithdrawCancellable(status(optionType, onChainStatus))).toBe(expected);
  });

  it.each(["PROCESSED", "FINALIZED"] as const)(
    "never cancels SAME_TX, paid in the initiating tx (%s)",
    (onChainStatus) => {
      expect(isExpressWithdrawCancellable(status("SAME_TX", onChainStatus))).toBe(false);
    },
  );
});
