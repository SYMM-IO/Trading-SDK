import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { ListingDepositChainId } from "../types";

const claimProfitV2ClaimPost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    claimProfitV2ClaimPost,
  };
});

import { claimProfit } from "./claim-profit";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

const REQUIRED = {
  accessToken: "TOKEN123",
  tokenContractAddress: "0xToken",
  depositChain: ListingDepositChainId.HYPER_EVM,
  accountAddress: "0xSubAccount",
  amount: 5_300_000_000_000_000_000n,
} as const;

describe("claimProfit", () => {
  beforeEach(() => {
    claimProfitV2ClaimPost.mockReset();
  });

  it("posts the mapped body with the bearer token and returns the normalized receipt", async () => {
    const { config } = mockConfig();
    claimProfitV2ClaimPost.mockResolvedValue({
      data: {
        status: "ok",
        // Plain decimal units (dollars) on the wire, scaled up to 1e18 by the mapper.
        amount: "5.3",
        claim_request_id: "claim-123",
        transaction_hash: "0xabc",
      },
    });

    await expect(claimProfit(config, { ...REQUIRED })).resolves.toEqual({
      status: "ok",
      amountClaimed: 5_300_000_000_000_000_000n,
      claimRequestId: "claim-123",
      transactionHash: "0xabc",
    });

    expect(claimProfitV2ClaimPost).toHaveBeenCalledWith(
      {
        amount: "5300000000000000000",
        token_contract_address: "0xToken",
        deposit_chain: ListingDepositChainId.HYPER_EVM,
        account_address: "0xSubAccount",
      },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(claimProfit(config, { ...REQUIRED, chainId: SymmioSupportedChainId.BASE })).rejects.toBeInstanceOf(
      SymmError,
    );
    await expect(claimProfit(config, { ...REQUIRED, chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      code: "LISTING_NOT_CONFIGURED",
    });
    expect(claimProfitV2ClaimPost).not.toHaveBeenCalled();
  });
});
