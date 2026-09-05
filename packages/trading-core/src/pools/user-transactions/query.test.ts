import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getUserTransactionsQueryKey, getUserTransactionsQueryOptions } from "./query";

describe("getUserTransactionsQueryKey", () => {
  it("drops the accessToken credential from the key", () => {
    const key = getUserTransactionsQueryKey({ accessToken: "secret", configKey: "chain-999" });

    expect(key[0]).toBe("getUserTransactions");
    expect(JSON.stringify(key)).not.toContain("secret");
  });
});

describe("getUserTransactionsQueryOptions", () => {
  it("builds a stable key and wires the queryFn to the action", async () => {
    const { config } = mockConfig();
    const getUserTransactions = vi
      .spyOn(await import("./get-user-transactions"), "getUserTransactions")
      .mockResolvedValue({ count: 0, items: [] });

    const options = getUserTransactionsQueryOptions(config, { accessToken: "t" });
    expect(options.queryKey[0]).toBe("getUserTransactions");

    await (options.queryFn as () => Promise<unknown>)();
    expect(getUserTransactions).toHaveBeenCalledWith(config, expect.objectContaining({ accessToken: "t" }));
    getUserTransactions.mockRestore();
  });
});
