import { describe, expect, it } from "vitest";
import { isExpressWithdrawPayoutComplete } from "./is-express-withdraw-payout-complete";
import type { ExpressWithdrawStatus } from "./types";

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

describe("isExpressWithdrawPayoutComplete", () => {
  it("does not treat STANDARD Core finalization as receiver payment", () => {
    expect(isExpressWithdrawPayoutComplete(status("STANDARD", "FINALIZED"))).toBe(false);
    expect(isExpressWithdrawPayoutComplete(status("STANDARD", "PROCESSED"))).toBe(true);
  });

  it.each(["SAME_TX", "WINDOWED"] as const)("accepts PROCESSED or FINALIZED for %s", (optionType) => {
    expect(isExpressWithdrawPayoutComplete(status(optionType, "PROCESSED"))).toBe(true);
    expect(isExpressWithdrawPayoutComplete(status(optionType, "FINALIZED"))).toBe(true);
    expect(isExpressWithdrawPayoutComplete(status(optionType, "LOCKED"))).toBe(false);
  });
});
