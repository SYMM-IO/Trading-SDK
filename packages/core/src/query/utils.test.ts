import { describe, expect, it } from "vitest";
import { filterQueryOptions } from "./utils";

describe("filterQueryOptions", () => {
  it("strips TanStack control fields and functions", () => {
    const out = filterQueryOptions({
      chainId: 999,
      user: "0xabc",
      query: { staleTime: 1 },
      scopeKey: "scope",
      enabled: true,
      select: () => 1,
    });
    expect(out).toEqual({ chainId: 999, user: "0xabc" });
  });

  it("serializes bigints to decimal strings, recursively", () => {
    const out = filterQueryOptions({ offset: 0n, limit: 200n, nested: { value: 5n } });
    expect(out).toEqual({ offset: "0", limit: "200", nested: { value: "5" } });
  });

  it("drops undefined values", () => {
    const out = filterQueryOptions({ chainId: 999, offset: undefined });
    expect(out).toEqual({ chainId: 999 });
  });
});
