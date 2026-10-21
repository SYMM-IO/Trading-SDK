import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../../core/config";
import { TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
import { getPoolMaintenanceFees } from "../maintenance-fees/get-pool-maintenance-fees";
import { getPoolMarketData } from "../market-data/get-pool-market-data";
import { getListingTokenMetadata } from "../token-metadata/get-listing-token-metadata";
import { checkListingTokenSupport } from "./check-listing-token-support";

const requests = vi.hoisted(() => ({ support: vi.fn(), metadata: vi.fn(), maintenance: vi.fn(), marketData: vi.fn() }));
vi.mock("../types/generated/listing-backend", () => ({
  checkTokenSupportV2MarketTokenSupportGet: requests.support,
  getTokenMetaDataV2MarketTokenMetaDataGet: requests.metadata,
  getMaintenanceFeeRecordsV2MarketMaintenanceFeesGet: requests.maintenance,
  getPoolsV2PoolsGet: requests.marketData,
}));

const config = createConfig({
  symmioConfig: {
    42161: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS }, listing: { url: "https://listing.example" } },
  },
  getClient: () => ({}) as PublicClient,
});
const parameters = { chainId: 42161, depositChain: 0, tokenContractAddress: "CaseSensitiveMint", accessToken: "TOKEN" };

describe("listing validation and maintenance reads", () => {
  beforeEach(() => vi.resetAllMocks());
  it("retains fractional batch rates and unknown values without changing exact address keys", async () => {
    requests.marketData.mockResolvedValue({
      data: {
        ExactMint: { market_cap: "123000000000000000000", apr: "12.75" },
        UnknownMint: { market_cap: null, apr: null },
      },
    });
    await expect(
      getPoolMarketData(config, { chainId: 42161, addresses: ["ExactMint", "UnknownMint"] }),
    ).resolves.toEqual({
      ExactMint: { marketCap: 123000000000000000000n, apr: 12n, reportedApr: "12.75" },
      UnknownMint: { marketCap: null, apr: null, reportedApr: null },
    });
  });
  it("does not confuse an HTTP-200 unsupported-token body with support", async () => {
    requests.support.mockResolvedValue({ data: { error_code: 26, error_message: "Unsupported token" } });
    await expect(checkListingTokenSupport(config, parameters)).rejects.toMatchObject({
      status: 200,
      responseData: { error_code: 26 },
      message: "Unsupported token",
    });
  });
  it("keeps a Solana chain and its address unchanged and authenticates the read", async () => {
    requests.support.mockResolvedValue({ data: {} });
    await expect(checkListingTokenSupport(config, parameters)).resolves.toBe(true);
    expect(requests.support).toHaveBeenCalledWith(
      { contract_address: "CaseSensitiveMint", chain: 0 },
      { baseURL: "https://listing.example", headers: { Authorization: "Bearer TOKEN" } },
    );
  });
  it("preserves missing metadata and an exact tiny price", async () => {
    requests.metadata.mockResolvedValue({
      data: {
        token_contract_address: "CaseSensitiveMint",
        chain: 0,
        token_name: "Token",
        token_ticker: null,
        price: "0.000000000123456789",
      },
    });
    expect(await getListingTokenMetadata(config, parameters)).toMatchObject({
      decimals: null,
      tokenTicker: null,
      price: "0.000000000123456789",
    });
  });
  it("rejects metadata errors returned with HTTP 200 without fabricating token metadata", async () => {
    requests.metadata.mockResolvedValue({ data: { error_code: 26, error_message: "Unsupported token" } });
    await expect(getListingTokenMetadata(config, parameters)).rejects.toMatchObject({
      status: 200,
      responseData: { error_code: 26 },
      message: "Unsupported token",
    });
  });
  it("preserves maintenance amounts and converts milliseconds exactly once", async () => {
    requests.maintenance.mockResolvedValue({
      data: {
        total: 21,
        items: [{ token_amount: "123456789012345678901", usdc_amount: "1", timestamp: 1700000000123, tx_hash: null }],
      },
    });
    expect(await getPoolMaintenanceFees(config, { ...parameters, limit: 10, offset: 10 })).toEqual({
      total: 21,
      items: [
        { tokenAmount: 123456789012345678901n, usdcAmount: 1n, timestamp: 1700000000.123, transactionHash: null },
      ],
    });
  });
});
