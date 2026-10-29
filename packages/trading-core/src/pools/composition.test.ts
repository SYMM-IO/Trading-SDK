import { describe, expect, it, vi } from "vitest";
import { readPages, type PoolReadGap } from "./composition";

describe("partial pool source reads", () => {
  it("retains earlier pages and reports a later failure", async () => {
    const gaps: PoolReadGap[] = [];
    const read = vi
      .fn()
      .mockResolvedValueOnce({ items: ["funded-pool"], total: 2 })
      .mockRejectedValueOnce(Error("offline"));
    await expect(readPages(read, (row: string) => row, gaps, "deposits")).resolves.toEqual(["funded-pool"]);
    expect(read.mock.calls.map(([offset]) => offset)).toEqual([0, 1]);
    expect(gaps).toEqual([{ source: "deposits", reason: "failed" }]);
  });

  it.each([401, 403])("still rejects an expired or forbidden session on a later page (%s)", async (status) => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ items: ["pool"], total: 2 })
      .mockRejectedValueOnce(Object.assign(Error("auth"), { status }));
    await expect(readPages(read, (row: string) => row, [], "deposits")).rejects.toMatchObject({ status });
  });
});
