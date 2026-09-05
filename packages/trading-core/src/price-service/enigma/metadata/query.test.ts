import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../../shared/test/mock-config";

const getMetadataApiV1MetadataGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-price-service")>();
  return {
    ...actual,
    getMetadataApiV1MetadataGet,
  };
});

import { getEnigmaPriceServiceMetadataQueryKey, getEnigmaPriceServiceMetadataQueryOptions } from "./query";

const PRICE_SERVICE_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).priceService.url;

/** Arbitrary symbol addresses — the price service treats them as opaque strings. */
const SYMBOL_A = "0x0000000000000000000000000000000000000a11";
const SYMBOL_B = "0x0000000000000000000000000000000000000b22";

describe("getEnigmaPriceServiceMetadataQueryOptions", () => {
  beforeEach(() => {
    getMetadataApiV1MetadataGet.mockReset();
  });

  it("is enabled by default once the required addresses are supplied", () => {
    const { config } = mockConfig();

    expect(getEnigmaPriceServiceMetadataQueryOptions(config, { addresses: [SYMBOL_A] }).enabled).toBe(true);
    /** An empty list is still "supplied" — the factory has no emptiness gate. */
    expect(getEnigmaPriceServiceMetadataQueryOptions(config, { addresses: [] }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();

    expect(
      getEnigmaPriceServiceMetadataQueryOptions(config, { addresses: [SYMBOL_A], query: { enabled: false } }).enabled,
    ).toBe(false);
  });

  it("queryFn delegates to the action, forwarding the joined addresses to the configured base URL", async () => {
    const data = { [SYMBOL_A]: { name: "AAA" }, [SYMBOL_B]: { name: "BBB" } };
    getMetadataApiV1MetadataGet.mockResolvedValue({ data });

    const { config } = mockConfig();
    const options = getEnigmaPriceServiceMetadataQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
      addresses: [SYMBOL_A, SYMBOL_B],
    });

    await expect(options.queryFn()).resolves.toBe(data);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledTimes(1);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledWith(
      { addresses: `${SYMBOL_A},${SYMBOL_B}` },
      { baseURL: PRICE_SERVICE_URL },
    );
  });

  it("queryFn forwards the factory's chainId to the action, surfacing UNSUPPORTED_CHAIN", async () => {
    const { config } = mockConfig();
    const options = getEnigmaPriceServiceMetadataQueryOptions(config, {
      chainId: mainnet.id,
      addresses: [SYMBOL_A],
    });

    const rejection = (await options.queryFn().catch((thrown: unknown) => thrown)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection.kind).toBe("config");
    expect(rejection.code).toBe("UNSUPPORTED_CHAIN");
    expect(getMetadataApiV1MetadataGet).not.toHaveBeenCalled();
  });

  it("builds a stable key from the chain id and the address list", () => {
    expect(
      getEnigmaPriceServiceMetadataQueryKey({
        chainId: SymmioSupportedChainId.HYPER_EVM,
        addresses: [SYMBOL_A, SYMBOL_B],
      }),
    ).toEqual([
      "getEnigmaPriceServiceMetadata",
      { chainId: SymmioSupportedChainId.HYPER_EVM, addresses: [SYMBOL_A, SYMBOL_B] },
    ]);
  });

  it("keys two different address lists apart, including by order", () => {
    /**
     * Asserted as exact payloads rather than a bare `not.toEqual`, so the test can only
     * pass when the difference is the address list itself and its ordering.
     */
    expect(getEnigmaPriceServiceMetadataQueryKey({ addresses: [SYMBOL_A] })[1]).toEqual({ addresses: [SYMBOL_A] });
    expect(getEnigmaPriceServiceMetadataQueryKey({ addresses: [SYMBOL_A, SYMBOL_B] })[1]).toEqual({
      addresses: [SYMBOL_A, SYMBOL_B],
    });
    expect(getEnigmaPriceServiceMetadataQueryKey({ addresses: [SYMBOL_B, SYMBOL_A] })[1]).toEqual({
      addresses: [SYMBOL_B, SYMBOL_A],
    });
  });

  it("copies the address list into the key so later mutation of the caller's array cannot rewrite it", () => {
    const addresses = [SYMBOL_A];
    const key = getEnigmaPriceServiceMetadataQueryKey({ addresses });

    addresses.push(SYMBOL_B);

    expect((key[1] as { addresses: string[] }).addresses).toEqual([SYMBOL_A]);
  });

  it("holds the caller's array by reference in queryFn, so a later mutation desynchronizes it from the key", async () => {
    /**
     * Documents current behavior, not desired behavior: the key snapshots the list (above)
     * but `queryFn` closes over `options.addresses` and joins it at call time. Mutating the
     * array after building the options changes the request while the key stays frozen.
     */
    getMetadataApiV1MetadataGet.mockResolvedValue({ data: {} });

    const { config } = mockConfig();
    const addresses = [SYMBOL_A];
    const options = getEnigmaPriceServiceMetadataQueryOptions(config, { addresses });

    addresses.push(SYMBOL_B);
    await options.queryFn();

    expect((options.queryKey[1] as { addresses: string[] }).addresses).toEqual([SYMBOL_A]);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledTimes(1);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledWith(
      { addresses: `${SYMBOL_A},${SYMBOL_B}` },
      { baseURL: PRICE_SERVICE_URL },
    );
  });

  it("keeps TanStack-only fields out of the key while still forwarding them", () => {
    const { config } = mockConfig();
    const options = getEnigmaPriceServiceMetadataQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
      addresses: [SYMBOL_A],
      query: { staleTime: 5_000 },
    });

    expect(options.staleTime).toBe(5_000);
    expect(options.queryKey[1]).toEqual({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      addresses: [SYMBOL_A],
      configKey: config.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM),
    });
  });

  it("omits an absent chainId from the factory key, leaving the addresses and the config fingerprint", () => {
    const { config } = mockConfig();

    const key = getEnigmaPriceServiceMetadataQueryOptions(config, { addresses: [SYMBOL_A] }).queryKey;

    expect(key[0]).toBe("getEnigmaPriceServiceMetadata");
    expect(key[1]).toEqual({ addresses: [SYMBOL_A], configKey: config.getChainConfigKey() });
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

    const baseKey = getEnigmaPriceServiceMetadataQueryOptions(base, { addresses: [SYMBOL_A] }).queryKey;
    const overriddenOptions = getEnigmaPriceServiceMetadataQueryOptions(overridden, { addresses: [SYMBOL_A] });

    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect((overriddenOptions.queryKey[1] as { configKey?: string }).configKey).toBe(overridden.getChainConfigKey());
    expect(overridden.getChainConfigKey()).not.toBe(base.getChainConfigKey());
    expect(overriddenOptions.queryKey[0]).toBe(baseKey[0]);
    expect(overriddenOptions.queryKey).not.toEqual(baseKey);

    /** The rekey must track a real behavioral change: the action now hits the overridden host. */
    getMetadataApiV1MetadataGet.mockResolvedValue({ data: {} });
    await overriddenOptions.queryFn();
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledWith({ addresses: SYMBOL_A }, { baseURL: overriddenUrl });
  });
});
