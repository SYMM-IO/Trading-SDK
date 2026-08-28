import { describe, expect, it } from "vitest";
import { toSolverRevenue } from "./to-solver-revenue";

describe("toSolverRevenue", () => {
  it("maps a live protocol-wide response", () => {
    expect(
      toSolverRevenue({
        total_revenue: "19139.500689364255989523",
        hedger_fee_revenue: "1896.824764273369288553",
        funding_revenue: "17242.675925090886700970",
        record_count: 99755,
      }),
    ).toEqual({
      totalRevenue: 19139.500689364257,
      hedgerFeeRevenue: 1896.8247642733693,
      fundingRevenue: 17242.675925090887,
      recordCount: 99755,
    });
  });

  it("keeps the two dimensions summing to the total", () => {
    const revenue = toSolverRevenue({
      total_revenue: "165.600043269464122325",
      hedger_fee_revenue: "9.555793673854525632",
      funding_revenue: "156.044249595609596693",
      record_count: 804,
    });

    expect(revenue.hedgerFeeRevenue + revenue.fundingRevenue).toBeCloseTo(revenue.totalRevenue, 9);
  });

  it("defaults every omitted dimension to zero", () => {
    expect(toSolverRevenue({})).toEqual({
      totalRevenue: 0,
      hedgerFeeRevenue: 0,
      fundingRevenue: 0,
      recordCount: 0,
    });
  });

  it("distinguishes an empty window from a window with no data via recordCount", () => {
    const earnedNothing = toSolverRevenue({ total_revenue: "0", record_count: 12 });
    const noData = toSolverRevenue({ total_revenue: "0", record_count: 0 });

    expect(earnedNothing.totalRevenue).toBe(0);
    expect(earnedNothing.recordCount).toBeGreaterThan(0);
    expect(noData.recordCount).toBe(0);
  });
});
