import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import { claimProfitMutationOptions } from "./query";

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
  depositChain: ListingDepositChainId.HYPER_EVM,
  accountAddress: "0xf55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A",
  amount: 1000000000000000000n,
} as const;

describe("claimProfitMutationOptions", () => {
  it("tags the mutation with a stable key", () => {
    const { config } = mockConfig();

    expect(claimProfitMutationOptions(config).mutationKey).toEqual(["claimProfit"]);
  });

  it("is a mutation, not cached data — the claim is a one-shot write", () => {
    const { config } = mockConfig();
    const options = claimProfitMutationOptions(config);

    expect(typeof options.mutationFn).toBe("function");
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config so the caller only supplies variables", async () => {
    const { config } = mockConfig();
    const receipt = {
      status: "ok",
      amountClaimed: 1000000000000000000n,
      claimRequestId: "claim-1",
      transactionHash: null,
    };
    const claimProfit = vi.spyOn(await import("./claim-profit"), "claimProfit").mockResolvedValue(receipt);

    await claimProfitMutationOptions(config).mutationFn(VARIABLES);

    expect(claimProfit).toHaveBeenCalledWith(config, VARIABLES);
    claimProfit.mockRestore();
  });
});
