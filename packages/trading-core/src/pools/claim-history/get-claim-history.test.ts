import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";

const postSearchClaimsV2ClaimSearchStartSizeGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    postSearchClaimsV2ClaimSearchStartSizeGet,
  };
});

import { getClaimHistory } from "./get-claim-history";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getClaimHistory", () => {
  beforeEach(() => {
    postSearchClaimsV2ClaimSearchStartSizeGet.mockReset();
  });

  it("requests the page with the bearer token and the token filter, and normalizes the response", async () => {
    const { config } = mockConfig();
    postSearchClaimsV2ClaimSearchStartSizeGet.mockResolvedValue({
      data: {
        total: 1,
        data: [
          {
            claim_request_id: "claim-1",
            wallet_id: "w",
            market_id: "m",
            amount: "5.3",
            account_address: "0xSubAccount",
            create_time: 1_700_000_000,
            transaction_hash: "0xabc",
          },
        ],
      },
    });

    await expect(
      getClaimHistory(config, { accessToken: "TOKEN123", tokenContractAddress: "0xToken", size: 25 }),
    ).resolves.toEqual({
      count: 1,
      items: [
        {
          claimRequestId: "claim-1",
          accountAddress: "0xSubAccount",
          amount: 5_300_000_000_000_000_000n,
          transactionHash: "0xabc",
          time: 1_700_000_000,
        },
      ],
    });

    expect(postSearchClaimsV2ClaimSearchStartSizeGet).toHaveBeenCalledWith(
      0,
      25,
      { token_contract_address: "0xToken" },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );
  });

  it("omits absent filters", async () => {
    const { config } = mockConfig();
    postSearchClaimsV2ClaimSearchStartSizeGet.mockResolvedValue({ data: { total: 0, data: [] } });

    await getClaimHistory(config, { accessToken: "t" });

    expect(postSearchClaimsV2ClaimSearchStartSizeGet).toHaveBeenCalledWith(0, 150, {}, expect.anything());
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getClaimHistory(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t" }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_CONFIGURED" });
    await expect(
      getClaimHistory(config, { chainId: SymmioSupportedChainId.BASE, accessToken: "t" }),
    ).rejects.toBeInstanceOf(SymmError);
    expect(postSearchClaimsV2ClaimSearchStartSizeGet).not.toHaveBeenCalled();
  });
});
