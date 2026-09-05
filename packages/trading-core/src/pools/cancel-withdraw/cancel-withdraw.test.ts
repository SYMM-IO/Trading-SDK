import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";

const cancelWithdrawV2MarketWithdrawWithdrawIdDelete = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    cancelWithdrawV2MarketWithdrawWithdrawIdDelete,
  };
});

import { cancelWithdraw } from "./cancel-withdraw";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("cancelWithdraw", () => {
  beforeEach(() => {
    cancelWithdrawV2MarketWithdrawWithdrawIdDelete.mockReset();
  });

  it("deletes the withdrawal by id with the bearer token and normalizes the receipt", async () => {
    const { config } = mockConfig();
    cancelWithdrawV2MarketWithdrawWithdrawIdDelete.mockResolvedValue({
      data: { transaction_id: "tx-1", transaction_status: "canceled" },
    });

    await expect(cancelWithdraw(config, { accessToken: "TOKEN123", withdrawId: "tx-1" })).resolves.toEqual({
      transactionId: "tx-1",
      status: "canceled",
    });

    expect(cancelWithdrawV2MarketWithdrawWithdrawIdDelete).toHaveBeenCalledWith(
      "tx-1",
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      cancelWithdraw(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t", withdrawId: "tx-1" }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    await expect(
      cancelWithdraw(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t", withdrawId: "tx-1" }),
    ).rejects.toBeInstanceOf(SymmError);
    expect(cancelWithdrawV2MarketWithdrawWithdrawIdDelete).not.toHaveBeenCalled();
  });
});
