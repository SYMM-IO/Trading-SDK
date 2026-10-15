import { describe, expect, it } from "vitest";
import { parseSolverFees } from "./solver-fees";

describe("parseSolverFees", () => {
  it("decodes both named tags and their total", () => {
    expect(
      parseSolverFees([
        ["SOLVER_FEE", "659102399999999"],
        ["STATIC_SOLVER_FEE", "100000000000000000"],
      ]),
    ).toEqual({
      solverFee: 659102399999999n,
      staticSolverFee: 100000000000000000n,
      totalSolverFee: 100659102399999999n,
    });
  });

  it("leaves the static fee null when only the rate-based entry is present", () => {
    expect(parseSolverFees([["SOLVER_FEE", "604033297835350"]])).toEqual({
      solverFee: 604033297835350n,
      staticSolverFee: null,
      totalSolverFee: 604033297835350n,
    });
  });

  it("returns all-null when the event recorded no solverFees list", () => {
    const absent = { solverFee: null, staticSolverFee: null, totalSolverFee: null };

    // Liquidation / ADL events and pre-0.8.6-indexed deployments omit the key.
    expect(parseSolverFees(undefined)).toEqual(absent);
    expect(parseSolverFees(null)).toEqual(absent);
    // A non-list value is as unusable as a missing one.
    expect(parseSolverFees("SOLVER_FEE")).toEqual(absent);
    expect(parseSolverFees({ SOLVER_FEE: "1" })).toEqual(absent);
  });

  it("reports a zero total for an empty list — fees were recorded, none charged", () => {
    expect(parseSolverFees([])).toEqual({ solverFee: null, staticSolverFee: null, totalSolverFee: 0n });
  });

  it("counts an unknown tag in the total without inventing a named field", () => {
    expect(
      parseSolverFees([
        ["SOLVER_FEE", "100"],
        ["FUTURE_SOLVER_FEE", "25"],
      ]),
    ).toEqual({ solverFee: 100n, staticSolverFee: null, totalSolverFee: 125n });
  });

  it("skips entries whose amount is malformed, and keeps the rest of the list", () => {
    expect(
      parseSolverFees([
        ["SOLVER_FEE", "not-a-number"],
        ["STATIC_SOLVER_FEE", "100"],
        ["SOLVER_FEE", ""],
        "SOLVER_FEE",
        ["STATIC_SOLVER_FEE"],
      ]),
    ).toEqual({ solverFee: null, staticSolverFee: 100n, totalSolverFee: 100n });
  });

  it("skips a negative amount rather than letting it shrink the total", () => {
    expect(
      parseSolverFees([
        ["SOLVER_FEE", "100"],
        ["STATIC_SOLVER_FEE", "-40"],
      ]),
    ).toEqual({ solverFee: 100n, staticSolverFee: null, totalSolverFee: 100n });
  });

  it("keeps a zero amount — a charged fee of nothing is still a recorded entry", () => {
    expect(parseSolverFees([["SOLVER_FEE", "0"]])).toEqual({
      solverFee: 0n,
      staticSolverFee: null,
      totalSolverFee: 0n,
    });
  });
});
