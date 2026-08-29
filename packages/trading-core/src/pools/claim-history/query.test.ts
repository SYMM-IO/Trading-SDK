import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getClaimHistoryQueryKey, getClaimHistoryQueryOptions } from "./query";

describe("getClaimHistoryQueryKey", () => {
  it("drops the accessToken credential from the key", () => {
    const key = getClaimHistoryQueryKey({
      accessToken: "secret",
      tokenContractAddress: "0xToken",
      configKey: "chain-999",
    });

    expect(key[0]).toBe("getClaimHistory");
    expect(JSON.stringify(key)).not.toContain("secret");
    expect(JSON.stringify(key)).toContain("0xToken");
  });
});

describe("getClaimHistoryQueryOptions", () => {
  it("builds a stable key and wires the queryFn to the action", async () => {
    const { config } = mockConfig();
    const getClaimHistory = vi
      .spyOn(await import("./get-claim-history"), "getClaimHistory")
      .mockResolvedValue({ count: 0, items: [] });

    const options = getClaimHistoryQueryOptions(config, { accessToken: "t", tokenContractAddress: "0xToken" });
    expect(options.queryKey[0]).toBe("getClaimHistory");

    await (options.queryFn as () => Promise<unknown>)();
    expect(getClaimHistory).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ accessToken: "t", tokenContractAddress: "0xToken" }),
    );
    getClaimHistory.mockRestore();
  });
});
