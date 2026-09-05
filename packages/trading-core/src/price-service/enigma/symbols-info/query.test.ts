import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../../shared/test/mock-config";
import { SymbolStatus, type SymbolInfo } from "../types/generated/enigma-price-service";

const getSymbolsInfoApiV1SymbolsInfoGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-price-service")>();
  return {
    ...actual,
    getSymbolsInfoApiV1SymbolsInfoGet,
  };
});

import { getEnigmaPriceServiceSymbolsInfoQueryKey, getEnigmaPriceServiceSymbolsInfoQueryOptions } from "./query";

const PRICE_SERVICE_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).priceService.url;

/**
 * Fixture typed as the generated `SymbolInfo` so a change to the generated shape
 * breaks this test instead of silently passing.
 */
const SYMBOLS: SymbolInfo[] = [
  { name: "BTCUSDT", status: SymbolStatus.TRADING, address: "0x0000000000000000000000000000000000000b71" },
  { name: "ETHUSDT", status: SymbolStatus.SETTLING, address: "0x0000000000000000000000000000000000000e74" },
];

describe("getEnigmaPriceServiceSymbolsInfoQueryOptions", () => {
  beforeEach(() => {
    getSymbolsInfoApiV1SymbolsInfoGet.mockReset();
  });

  it("is enabled by default, even with no options at all", () => {
    const { config } = mockConfig();

    expect(getEnigmaPriceServiceSymbolsInfoQueryOptions(config).enabled).toBe(true);
    expect(getEnigmaPriceServiceSymbolsInfoQueryOptions(config, {}).enabled).toBe(true);
    expect(getEnigmaPriceServiceSymbolsInfoQueryOptions(config, { query: {} }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();

    expect(getEnigmaPriceServiceSymbolsInfoQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
    expect(getEnigmaPriceServiceSymbolsInfoQueryOptions(config, { query: { enabled: true } }).enabled).toBe(true);
  });

  it("queryFn delegates to the action against the configured base URL", async () => {
    getSymbolsInfoApiV1SymbolsInfoGet.mockResolvedValue({ data: SYMBOLS });

    const { config } = mockConfig();
    const options = getEnigmaPriceServiceSymbolsInfoQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
    });

    await expect(options.queryFn()).resolves.toBe(SYMBOLS);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledTimes(1);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledWith({ baseURL: PRICE_SERVICE_URL });
  });

  it("queryFn forwards the factory's chainId to the action, surfacing UNSUPPORTED_CHAIN", async () => {
    const { config } = mockConfig();
    const options = getEnigmaPriceServiceSymbolsInfoQueryOptions(config, { chainId: mainnet.id });

    const rejection = (await options.queryFn().catch((thrown: unknown) => thrown)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection.kind).toBe("config");
    expect(rejection.code).toBe("UNSUPPORTED_CHAIN");
    expect(rejection.message).toBe(`Unsupported chain id: ${mainnet.id}.`);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).not.toHaveBeenCalled();
  });

  it("builds the options bag without issuing a request — the queryFn stays lazy", () => {
    const { config } = mockConfig();

    getEnigmaPriceServiceSymbolsInfoQueryOptions(config, { chainId: SymmioSupportedChainId.HYPER_EVM });

    expect(getSymbolsInfoApiV1SymbolsInfoGet).not.toHaveBeenCalled();
  });

  it("builds a zero-arg key with an empty payload", () => {
    expect(getEnigmaPriceServiceSymbolsInfoQueryKey()).toEqual(["getEnigmaPriceServiceSymbolsInfo", {}]);
  });

  it("drops an explicitly `undefined` chainId so it keys identically to the zero-arg call", () => {
    const { config } = mockConfig();

    const explicitUndefined = getEnigmaPriceServiceSymbolsInfoQueryOptions(config, { chainId: undefined }).queryKey;
    const absent = getEnigmaPriceServiceSymbolsInfoQueryOptions(config).queryKey;

    expect(Object.keys(explicitUndefined[1])).toEqual(["configKey"]);
    expect(explicitUndefined).toEqual(absent);
  });

  it("builds a stable key from the chain id", () => {
    expect(getEnigmaPriceServiceSymbolsInfoQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM })).toEqual([
      "getEnigmaPriceServiceSymbolsInfo",
      { chainId: SymmioSupportedChainId.HYPER_EVM },
    ]);
  });

  it("keeps TanStack-only fields out of the key while still forwarding them", () => {
    const { config } = mockConfig();
    const options = getEnigmaPriceServiceSymbolsInfoQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
      query: { staleTime: 5_000, retry: false },
    });

    expect(options.staleTime).toBe(5_000);
    expect(options.retry).toBe(false);
    expect(options.queryKey[1]).toEqual({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      configKey: config.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM),
    });
  });

  it("omits an absent chainId from the factory key, leaving only the config fingerprint", () => {
    const { config } = mockConfig();

    const key = getEnigmaPriceServiceSymbolsInfoQueryOptions(config).queryKey;

    expect(key[0]).toBe("getEnigmaPriceServiceSymbolsInfo");
    expect(key[1]).toEqual({ configKey: config.getChainConfigKey() });
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", async () => {
    const overriddenUrl = `${PRICE_SERVICE_URL}/alternate`;
    const { config: base } = mockConfig();
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
          priceService: { url: overriddenUrl },
        },
      },
    });

    const baseKey = getEnigmaPriceServiceSymbolsInfoQueryOptions(base).queryKey;
    const overriddenOptions = getEnigmaPriceServiceSymbolsInfoQueryOptions(overridden);

    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect((overriddenOptions.queryKey[1] as { configKey?: string }).configKey).toBe(overridden.getChainConfigKey());
    expect(overridden.getChainConfigKey()).not.toBe(base.getChainConfigKey());
    expect(overriddenOptions.queryKey[0]).toBe(baseKey[0]);
    expect(overriddenOptions.queryKey).not.toEqual(baseKey);

    /** The rekey must track a real behavioral change: the action now hits the overridden host. */
    getSymbolsInfoApiV1SymbolsInfoGet.mockResolvedValue({ data: SYMBOLS });
    await overriddenOptions.queryFn();
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledTimes(1);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledWith({ baseURL: overriddenUrl });
  });

  it("keys an unsupported chain apart from the supported one instead of reusing its fingerprint", () => {
    const { config } = mockConfig();

    const unsupported = getEnigmaPriceServiceSymbolsInfoQueryOptions(config, { chainId: mainnet.id }).queryKey;
    const supported = getEnigmaPriceServiceSymbolsInfoQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
    }).queryKey;

    expect(unsupported[1]).toEqual({ chainId: mainnet.id, configKey: config.getChainConfigKey(mainnet.id) });
    expect((unsupported[1] as { configKey?: string }).configKey).not.toBe(
      (supported[1] as { configKey?: string }).configKey,
    );
    /** Building the key must not throw even though the queryFn for it will reject. */
    expect(unsupported[0]).toBe("getEnigmaPriceServiceSymbolsInfo");
  });
});
