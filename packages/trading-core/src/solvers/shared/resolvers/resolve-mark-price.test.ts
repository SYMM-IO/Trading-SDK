import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { TEST_AFFILIATE_ADDRESS } from "../../../shared/test/mock-config";

const fetchEnigmaMarkPrices = vi.hoisted(() => vi.fn());
const fetchBinanceMarkPrices = vi.hoisted(() => vi.fn());

vi.mock("../../../price-service/adapters/enigma-mark-prices", () => ({ fetchEnigmaMarkPrices }));
vi.mock("../../../price-service/adapters/binance-mark-prices", () => ({ fetchBinanceMarkPrices }));

import { resolveMarkPrice } from "./resolve-mark-price";

const CHAIN = SymmioSupportedChainId.BASE;
const ENIGMA = { type: "enigma" as const, url: "https://enigma-price.test", wsUrl: "wss://enigma-price.test/ws" };
const BINANCE = {
  type: "binance" as const,
  url: "https://fapi.binance.com",
  wsUrl: "wss://fstream.binance.com/market/ws/!markPrice@arr@1s",
};

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [CHAIN]: {
      addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
      priceService: ENIGMA,
      defaultSolverId: "enigma",
      solvers: {
        enigma: { name: "Enigma", address: TEST_AFFILIATE_ADDRESS, url: "https://enigma.test" },
        rasa: {
          name: "Rasa",
          address: TEST_AFFILIATE_ADDRESS,
          url: "https://rasa.test",
          priceService: BINANCE,
        },
      },
    },
  },
});

describe("resolveMarkPrice", () => {
  beforeEach(() => {
    fetchEnigmaMarkPrices.mockReset().mockResolvedValue([]);
    fetchBinanceMarkPrices.mockReset().mockResolvedValue([]);
  });

  it("returns the caller-supplied price without any network call", async () => {
    const price = await resolveMarkPrice(config, { chainId: CHAIN, marketName: "BTCUSDT", markPrice: "123" });

    expect(price).toBe("123");
    expect(fetchEnigmaMarkPrices).not.toHaveBeenCalled();
    expect(fetchBinanceMarkPrices).not.toHaveBeenCalled();
  });

  it("prices a lowcap solver off its Enigma service", async () => {
    fetchEnigmaMarkPrices.mockResolvedValue([{ provider: "enigma", name: "BTCUSDT", markPrice: "64790.2" }]);

    const price = await resolveMarkPrice(config, { chainId: CHAIN, solverId: "enigma", marketName: "BTCUSDT" });

    expect(price).toBe("64790.2");
    expect(fetchEnigmaMarkPrices).toHaveBeenCalledWith(ENIGMA.url, ["BTCUSDT"]);
  });

  /** The point of the slice: a majors trade signs against a Binance mark. */
  it("prices a majors solver off Binance", async () => {
    fetchBinanceMarkPrices.mockResolvedValue([
      { provider: "binance", name: "BTCUSDT", markPrice: "64799.90000000", indexPrice: "1" },
    ]);

    const price = await resolveMarkPrice(config, { chainId: CHAIN, solverId: "rasa", marketName: "BTCUSDT" });

    expect(price).toBe("64799.90000000");
    expect(fetchBinanceMarkPrices).toHaveBeenCalledWith(BINANCE.url, ["BTCUSDT"]);
    expect(fetchEnigmaMarkPrices).not.toHaveBeenCalled();
  });

  /**
   * Preserves the exact decimal string the provider sent. This value is
   * `toWeiBigInt`'d into a signed EIP-712 payload, so any reformatting here is a
   * trade-path defect.
   */
  it("returns the provider's decimal string byte-for-byte", async () => {
    fetchEnigmaMarkPrices.mockResolvedValue([
      { provider: "enigma", name: "TIBBIR::A4..00_SFLOW", markPrice: "0.10691489650882736" },
    ]);

    const price = await resolveMarkPrice(config, {
      chainId: CHAIN,
      solverId: "enigma",
      marketName: "TIBBIR::A4..00_SFLOW",
    });

    expect(price).toBe("0.10691489650882736");
  });

  it("throws RESOLVE_MARK_PRICE_NOT_FOUND naming the provider when the name is absent", async () => {
    try {
      await resolveMarkPrice(config, { chainId: CHAIN, solverId: "rasa", marketName: "NOPEUSDT" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SymmError);
      expect((err as SymmError).code).toBe("RESOLVE_MARK_PRICE_NOT_FOUND");
      expect((err as SymmError).message).toMatch(/"binance"/);
    }
  });

  /** The most likely failure during the majors migration. */
  it("hints at the lowcap-name mismatch when a `::` name is sent to Binance", async () => {
    await expect(
      resolveMarkPrice(config, { chainId: CHAIN, solverId: "rasa", marketName: "TIBBIR::A4..00_SFLOW" }),
    ).rejects.toThrow(/looks like a lowcap market name/);
  });

  it("matches case-insensitively when the provider canonicalizes differently", async () => {
    fetchBinanceMarkPrices.mockResolvedValue([{ provider: "binance", name: "BTCUSDT", markPrice: "1" }]);

    expect(await resolveMarkPrice(config, { chainId: CHAIN, solverId: "rasa", marketName: "btcusdt" })).toBe("1");
  });
});
