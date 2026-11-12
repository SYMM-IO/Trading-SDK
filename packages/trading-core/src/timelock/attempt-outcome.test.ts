import { UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import {
  getTimelockRecoveryTransactionHash,
  hasTimelockSubmissionEvidence,
  isDefiniteGaslessSimulationRejection,
  isDefiniteTimelockApprovalRejection,
  isUnsubmittedTimelockWalletRejection,
} from "./attempt-outcome";

describe("timelock attempt outcomes", () => {
  it("recognizes documented approval rejections", () => {
    expect(isDefiniteTimelockApprovalRejection({ kind: "api", status: 400, timelock: { knownCode: 3703 } })).toBe(true);
    expect(isDefiniteTimelockApprovalRejection({ kind: "api", status: 503, timelock: { knownCode: 3703 } })).toBe(
      false,
    );
  });

  it("releases a wallet rejection only when no submission evidence exists", () => {
    const rejected = new UserRejectedRequestError(new Error("Rejected"));
    expect(isUnsubmittedTimelockWalletRejection({ kind: "user-rejected", cause: rejected })).toBe(true);
    expect(isUnsubmittedTimelockWalletRejection({ kind: "user-rejected", requestId: "relay-1", cause: rejected })).toBe(
      false,
    );
  });

  it("finds nested transaction evidence", () => {
    const hash = `0x${"11".repeat(32)}`;
    const error = { cause: { transactionHash: hash } };
    expect(getTimelockRecoveryTransactionHash(error)).toBe(hash);
    expect(hasTimelockSubmissionEvidence(error)).toBe(true);
    expect(hasTimelockSubmissionEvidence({ responseData: { transactionHash: hash } })).toBe(true);
  });

  it("recognizes only an unsubmitted gasless simulation rejection", () => {
    const rejection = {
      status: 400,
      responseData: { detail: { code: "SIMULATION_REVERTED", message: "reverted" } },
    };
    expect(isDefiniteGaslessSimulationRejection({ cause: rejection })).toBe(true);
    expect(isDefiniteGaslessSimulationRejection({ hash: `0x${"12".repeat(32)}`, cause: rejection })).toBe(false);
    expect(isDefiniteGaslessSimulationRejection({ status: 0 })).toBe(false);
    expect(isDefiniteGaslessSimulationRejection({ status: 400, responseData: { detail: { code: "OTHER" } } })).toBe(
      false,
    );
  });
});
