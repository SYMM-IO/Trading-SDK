import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";

const getWeeklyListingLimitV2MarketWeeklyListingLimitGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    getWeeklyListingLimitV2MarketWeeklyListingLimitGet,
  };
});

import { getWeeklyListingLimit } from "./get-weekly-listing-limit";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).listing?.url;

describe("getWeeklyListingLimit", () => {
  beforeEach(() => {
    getWeeklyListingLimitV2MarketWeeklyListingLimitGet.mockReset();
  });

  it("reads the enigma listing endpoint at its base URL and normalizes the response", async () => {
    const { config } = mockConfig();
    getWeeklyListingLimitV2MarketWeeklyListingLimitGet.mockResolvedValue({
      data: { limit: 5, remaining: 2, reset_at: 1735689600 },
    });

    const result = await getWeeklyListingLimit(config, {});

    expect(getWeeklyListingLimitV2MarketWeeklyListingLimitGet).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: LISTING_URL }),
    );
    expect(result).toEqual({ limit: 5, remaining: 2, resetAt: 1735689600 });
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(getWeeklyListingLimit(config, { chainId: SymmioSupportedChainId.BASE })).rejects.toBeInstanceOf(
      SymmError,
    );
    await expect(getWeeklyListingLimit(config, { chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      code: "LISTING_NOT_CONFIGURED",
    });
    expect(getWeeklyListingLimitV2MarketWeeklyListingLimitGet).not.toHaveBeenCalled();
  });
});
