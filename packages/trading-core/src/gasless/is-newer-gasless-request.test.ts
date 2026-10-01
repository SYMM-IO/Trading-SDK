import { describe, expect, it } from "vitest";
import { isNewerGaslessRequest } from "./is-newer-gasless-request";
import { operationRequestFixture } from "./test/records";
import { GaslessRequestStatus, type GaslessRequest } from "./types";

function record(
  status: GaslessRequestStatus,
  overrides?: { updatedAt?: string | null; requestId?: string },
): GaslessRequest {
  return operationRequestFixture({ status, ...overrides });
}

describe("isNewerGaslessRequest", () => {
  it("accepts anything when nothing is held yet", () => {
    expect(isNewerGaslessRequest(undefined, record(GaslessRequestStatus.QUEUED))).toBe(true);
  });

  it("accepts a forward lifecycle step", () => {
    expect(isNewerGaslessRequest(record(GaslessRequestStatus.QUEUED), record(GaslessRequestStatus.SUBMITTED))).toBe(
      true,
    );
    expect(isNewerGaslessRequest(record(GaslessRequestStatus.SUBMITTED), record(GaslessRequestStatus.SUCCEEDED))).toBe(
      true,
    );
  });

  it("drops a stale response that would repaint a live workflow as pending", () => {
    expect(isNewerGaslessRequest(record(GaslessRequestStatus.SUBMITTED), record(GaslessRequestStatus.QUEUED))).toBe(
      false,
    );
  });

  it("keeps a terminal record sticky — it is immutable, nothing supersedes it", () => {
    for (const status of [
      GaslessRequestStatus.SUCCEEDED,
      GaslessRequestStatus.REVERTED,
      GaslessRequestStatus.FAILED,
      GaslessRequestStatus.REJECTED,
    ]) {
      expect(isNewerGaslessRequest(record(status), record(GaslessRequestStatus.SUBMITTED))).toBe(false);
      expect(isNewerGaslessRequest(record(status), record(GaslessRequestStatus.QUEUED))).toBe(false);
    }
  });

  it("falls back to updatedAt within one lifecycle step", () => {
    const older = record(GaslessRequestStatus.SUBMITTED, { updatedAt: "2026-09-18T10:00:00Z" });
    const newer = record(GaslessRequestStatus.SUBMITTED, { updatedAt: "2026-09-18T10:00:05Z" });

    expect(isNewerGaslessRequest(older, newer)).toBe(true);
    expect(isNewerGaslessRequest(newer, older)).toBe(false);
    /** A re-read of the same instant is not stale — its other fields may have filled in. */
    expect(isNewerGaslessRequest(newer, newer)).toBe(true);
  });

  it("accepts the new record when either side carries no usable timestamp", () => {
    const stamped = record(GaslessRequestStatus.QUEUED, { updatedAt: "2026-09-18T10:00:05Z" });
    const unstamped = record(GaslessRequestStatus.QUEUED, { updatedAt: null });
    const unparseable = record(GaslessRequestStatus.QUEUED, { updatedAt: "whenever" });

    expect(isNewerGaslessRequest(stamped, unstamped)).toBe(true);
    expect(isNewerGaslessRequest(unstamped, stamped)).toBe(true);
    expect(isNewerGaslessRequest(stamped, unparseable)).toBe(true);
  });

  it("never treats a different request as stale", () => {
    const held = record(GaslessRequestStatus.SUCCEEDED, { requestId: "req-1" });
    const other = record(GaslessRequestStatus.QUEUED, { requestId: "req-2" });

    expect(isNewerGaslessRequest(held, other)).toBe(true);
  });
});
