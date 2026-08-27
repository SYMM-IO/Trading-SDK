import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";

const withdrawV2MarketWithdrawPost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    withdrawV2MarketWithdrawPost,
  };
});

import { withdrawLp } from "./withdraw-lp";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("withdrawLp", () => {
  beforeEach(() => {
    withdrawV2MarketWithdrawPost.mockReset();
  });

  it("posts the mapped request body with the bearer token to the enigma listing endpoint", async () => {
    const { config } = mockConfig();
    withdrawV2MarketWithdrawPost.mockResolvedValue({ data: {} });

    await expect(
      withdrawLp(config, {
        accessToken: "TOKEN123",
        marketAddress: "0xToken",
        withdrawAddress: "0xRecipient",
        amount: 5_300_000_000_000_000_000n,
      }),
    ).resolves.toBeUndefined();

    expect(withdrawV2MarketWithdrawPost).toHaveBeenCalledWith(
      {
        amount: "5300000000000000000",
        market_address: "0xToken",
        withdraw_address: "0xRecipient",
      },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      withdrawLp(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        marketAddress: "0xToken",
        withdrawAddress: "0xRecipient",
        amount: 1_000_000_000_000_000_000n,
      }),
    ).rejects.toBeInstanceOf(SymmError);
    await expect(
      withdrawLp(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        marketAddress: "0xToken",
        withdrawAddress: "0xRecipient",
        amount: 1_000_000_000_000_000_000n,
      }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    expect(withdrawV2MarketWithdrawPost).not.toHaveBeenCalled();
  });
});
