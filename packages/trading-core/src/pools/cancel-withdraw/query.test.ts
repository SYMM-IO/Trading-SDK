import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { cancelWithdrawMutationOptions } from "./query";

const VARIABLES = { accessToken: "eyJhbGc.header.sig", withdrawId: "tx-1" } as const;

describe("cancelWithdrawMutationOptions", () => {
  it("tags the mutation with a stable key", () => {
    const { config } = mockConfig();

    expect(cancelWithdrawMutationOptions(config).mutationKey).toEqual(["cancelWithdraw"]);
  });

  it("is a mutation, not cached data", () => {
    const { config } = mockConfig();
    const options = cancelWithdrawMutationOptions(config);

    expect(typeof options.mutationFn).toBe("function");
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config so the caller only supplies variables", async () => {
    const { config } = mockConfig();
    const cancelWithdraw = vi
      .spyOn(await import("./cancel-withdraw"), "cancelWithdraw")
      .mockResolvedValue({ transactionId: "tx-1", status: "canceled" });

    await cancelWithdrawMutationOptions(config).mutationFn(VARIABLES);

    expect(cancelWithdraw).toHaveBeenCalledWith(config, VARIABLES);
    cancelWithdraw.mockRestore();
  });
});
