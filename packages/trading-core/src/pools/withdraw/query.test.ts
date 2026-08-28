import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { withdrawLpMutationOptions } from "./query";

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  marketAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  withdrawAddress: "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A",
  amount: 1000000000000000000n,
} as const;

describe("withdrawLpMutationOptions", () => {
  it("tags the mutation with a stable key", () => {
    const { config } = mockConfig();

    expect(withdrawLpMutationOptions(config).mutationKey).toEqual(["withdrawLp"]);
  });

  it("is a mutation, not cached data — the withdrawal is a one-shot write", () => {
    const { config } = mockConfig();
    const options = withdrawLpMutationOptions(config);

    expect(typeof options.mutationFn).toBe("function");
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config so the caller only supplies variables", async () => {
    const { config } = mockConfig();
    const withdrawLp = vi.spyOn(await import("./withdraw-lp"), "withdrawLp").mockResolvedValue(undefined as never);

    await withdrawLpMutationOptions(config).mutationFn(VARIABLES);

    expect(withdrawLp).toHaveBeenCalledWith(config, VARIABLES);
    withdrawLp.mockRestore();
  });
});
