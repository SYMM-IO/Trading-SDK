import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";

const getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/inventory-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/inventory-service")>();
  return {
    ...actual,
    getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet,
  };
});

import { getInventoryTvlHistory } from "./get-inventory-tvl-history";

const INVENTORY_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).inventory?.url;
const SYMBOL_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("getInventoryTvlHistory", () => {
  beforeEach(() => {
    getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet.mockReset();
  });

  it("passes the symbol address first, targets the chain's inventory service, and normalizes every point", async () => {
    const { config } = mockConfig();
    getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet.mockResolvedValue({
      data: [
        { timestamp: 1_752_364_800, tvl: "177780000000000000000" },
        { timestamp: 1_752_451_200, tvl: "180000000000000000000" },
      ],
    });

    const history = await getInventoryTvlHistory(config, { symbolAddress: SYMBOL_ADDRESS });

    expect(getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet).toHaveBeenCalledWith(
      SYMBOL_ADDRESS,
      expect.objectContaining({ baseURL: INVENTORY_URL }),
    );
    expect(history).toEqual([
      { timestamp: 1_752_364_800, tvl: 177780000000000000000n },
      { timestamp: 1_752_451_200, tvl: 180000000000000000000n },
    ]);
  });

  it("returns an empty series when the service answers with no body", async () => {
    const { config } = mockConfig();
    getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet.mockResolvedValue({ data: undefined });

    await expect(getInventoryTvlHistory(config, { symbolAddress: SYMBOL_ADDRESS })).resolves.toEqual([]);
  });

  it("throws INVENTORY_NOT_CONFIGURED before any request when the chain has no inventory service", async () => {
    const { config } = mockConfig();

    await expect(
      getInventoryTvlHistory(config, { chainId: SymmioSupportedChainId.BASE, symbolAddress: SYMBOL_ADDRESS }),
    ).rejects.toBeInstanceOf(SymmError);
    await expect(
      getInventoryTvlHistory(config, { chainId: SymmioSupportedChainId.BASE, symbolAddress: SYMBOL_ADDRESS }),
    ).rejects.toMatchObject({ code: "INVENTORY_NOT_CONFIGURED" });
    expect(getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet).not.toHaveBeenCalled();
  });
});
