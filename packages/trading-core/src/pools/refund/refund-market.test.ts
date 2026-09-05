import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const refundV2MarketRefundPost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    refundV2MarketRefundPost,
  };
});

import { refundMarket } from "./refund-market";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

const REQUIRED = {
  accessToken: "TOKEN123",
  marketAddress: "0xToken",
  depositChain: ListingDepositChainId.HYPER_EVM,
  recipientAddress: "0xRecipient",
} as const;

describe("refundMarket", () => {
  beforeEach(() => {
    refundV2MarketRefundPost.mockReset();
  });

  it("posts the mapped body with the bearer token and returns the tx hash", async () => {
    const { config } = mockConfig();
    refundV2MarketRefundPost.mockResolvedValue({ data: { tx_hash: "0xabc" } });

    await expect(refundMarket(config, { ...REQUIRED })).resolves.toEqual({ transactionHash: "0xabc" });

    expect(refundV2MarketRefundPost).toHaveBeenCalledWith(
      {
        market_address: "0xToken",
        deposit_chain: ListingDepositChainId.HYPER_EVM,
        recipient_address: "0xRecipient",
      },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(refundMarket(config, { ...REQUIRED, chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      code: "LISTING_NOT_CONFIGURED",
    });
    await expect(refundMarket(config, { ...REQUIRED, chainId: SymmioSupportedChainId.BASE })).rejects.toBeInstanceOf(
      SymmError,
    );
    expect(refundV2MarketRefundPost).not.toHaveBeenCalled();
  });
});
