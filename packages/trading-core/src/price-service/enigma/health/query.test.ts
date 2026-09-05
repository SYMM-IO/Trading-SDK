import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../../shared/test/mock-config";

const healthCheckHealthGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-price-service")>();
  return {
    ...actual,
    healthCheckHealthGet,
  };
});

import { getEnigmaPriceServiceHealthQueryKey, getEnigmaPriceServiceHealthQueryOptions } from "./query";

const PRICE_SERVICE_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).priceService.url;

describe("getEnigmaPriceServiceHealthQueryOptions", () => {
  beforeEach(() => {
    healthCheckHealthGet.mockReset();
  });

  it("is enabled by default, even with no options at all", () => {
    const { config } = mockConfig();

    expect(getEnigmaPriceServiceHealthQueryOptions(config).enabled).toBe(true);
    expect(getEnigmaPriceServiceHealthQueryOptions(config, {}).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();

    expect(getEnigmaPriceServiceHealthQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("queryFn delegates to the action against the configured base URL", async () => {
    const data = { status: "ok", uptime: 42 };
    healthCheckHealthGet.mockResolvedValue({ data });

    const { config } = mockConfig();
    const options = getEnigmaPriceServiceHealthQueryOptions(config, { chainId: SymmioSupportedChainId.HYPER_EVM });

    await expect(options.queryFn()).resolves.toBe(data);
    expect(healthCheckHealthGet).toHaveBeenCalledTimes(1);
    expect(healthCheckHealthGet).toHaveBeenCalledWith({ baseURL: PRICE_SERVICE_URL });
  });

  it("queryFn forwards the factory's chainId to the action, surfacing UNSUPPORTED_CHAIN", async () => {
    const { config } = mockConfig();
    const options = getEnigmaPriceServiceHealthQueryOptions(config, { chainId: mainnet.id });

    const rejection = (await options.queryFn().catch((thrown: unknown) => thrown)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection.kind).toBe("config");
    expect(rejection.code).toBe("UNSUPPORTED_CHAIN");
    expect(healthCheckHealthGet).not.toHaveBeenCalled();
  });

  it("builds a zero-arg key with an empty payload", () => {
    expect(getEnigmaPriceServiceHealthQueryKey()).toEqual(["getEnigmaPriceServiceHealth", {}]);
  });

  it("builds a stable key from the chain id", () => {
    expect(getEnigmaPriceServiceHealthQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM })).toEqual([
      "getEnigmaPriceServiceHealth",
      { chainId: SymmioSupportedChainId.HYPER_EVM },
    ]);
  });

  it("keeps TanStack-only fields out of the key while still forwarding them", () => {
    const { config } = mockConfig();
    const options = getEnigmaPriceServiceHealthQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
      query: { staleTime: 5_000 },
    });

    expect(options.staleTime).toBe(5_000);
    expect(options.queryKey[1]).toEqual({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      configKey: config.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM),
    });
  });

  it("omits an absent chainId from the factory key, leaving only the config fingerprint", () => {
    const { config } = mockConfig();

    const key = getEnigmaPriceServiceHealthQueryOptions(config).queryKey;

    expect(key[0]).toBe("getEnigmaPriceServiceHealth");
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

    const baseKey = getEnigmaPriceServiceHealthQueryOptions(base).queryKey;
    const overriddenOptions = getEnigmaPriceServiceHealthQueryOptions(overridden);

    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect((overriddenOptions.queryKey[1] as { configKey?: string }).configKey).toBe(overridden.getChainConfigKey());
    expect(overridden.getChainConfigKey()).not.toBe(base.getChainConfigKey());
    expect(overriddenOptions.queryKey[0]).toBe(baseKey[0]);
    expect(overriddenOptions.queryKey).not.toEqual(baseKey);

    /** The rekey must track a real behavioral change: the action now hits the overridden host. */
    healthCheckHealthGet.mockResolvedValue({ data: { status: "ok" } });
    await overriddenOptions.queryFn();
    expect(healthCheckHealthGet).toHaveBeenCalledWith({ baseURL: overriddenUrl });
  });
});
