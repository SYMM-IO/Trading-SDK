import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";
import { refundMarketMutationOptions } from "./query";

const VARIABLES = {
  accessToken: "eyJhbGc.header.sig",
  marketAddress: "0xToken",
  depositChain: ListingDepositChainId.HYPER_EVM,
  recipientAddress: "0xRecipient",
} as const;

describe("refundMarketMutationOptions", () => {
  it("tags the mutation with a stable key", () => {
    const { config } = mockConfig();

    expect(refundMarketMutationOptions(config).mutationKey).toEqual(["refundMarket"]);
  });

  it("binds the config so the caller only supplies variables", async () => {
    const { config } = mockConfig();
    const refundMarket = vi
      .spyOn(await import("./refund-market"), "refundMarket")
      .mockResolvedValue({ transactionHash: "0xabc" });

    await refundMarketMutationOptions(config).mutationFn(VARIABLES);

    expect(refundMarket).toHaveBeenCalledWith(config, VARIABLES);
    refundMarket.mockRestore();
  });
});
