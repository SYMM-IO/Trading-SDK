import axios, { type AxiosResponse } from "axios";
import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
import type { TpSlSigningSpec } from "../types";
import { getTpSlDeleteSigningSpecQueryKey } from "./delete-query";
import { getTpSlSigningSpecQueryKey, getTpSlSigningSpecQueryOptions } from "./query";

const TPSL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solvers.enigma!.tpsl!;
const SPEC_PATH = "/api/v5/signing-spec";
/** The exact axios request config the action builds from the chain's tpsl block. */
const EXPECTED_REQUEST = {
  baseURL: TPSL.url,
  headers: { "App-Name": TPSL.appName, Accept: "application/json" },
};
/** Base URL a caller-supplied chain override swaps in — proves the fingerprint tracks real config. */
const OVERRIDE_URL = "https://tpsl.override.test";

const SIGNING_SPEC: TpSlSigningSpec = {
  domain: {
    name: "SymmioConditionalOrder",
    version: "1",
    chainId: SymmioSupportedChainId.HYPER_EVM,
    verifyingContract: TPSL.cohWalletAddress,
  },
  types: {
    ConditionalOrder: [
      { name: "virtualAccount", type: "address" },
      { name: "salt", type: "string" },
    ],
  },
  primaryType: "ConditionalOrder",
};

function okResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} } as AxiosResponse["config"],
  } as AxiosResponse<T>;
}

/** A config whose HYPER_EVM tpsl block only overrides `url`, leaving `appName` from the registry. */
function overriddenConfig() {
  return createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: {
      [SymmioSupportedChainId.HYPER_EVM]: {
        addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
        solvers: { enigma: { tpsl: { url: OVERRIDE_URL } } },
      },
    },
  });
}

describe("getTpSlSigningSpecQueryOptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is enabled by default", () => {
    const { config } = mockConfig();
    expect(getTpSlSigningSpecQueryOptions(config).enabled).toBe(true);
    expect(getTpSlSigningSpecQueryOptions(config, { chainId: SymmioSupportedChainId.HYPER_EVM }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getTpSlSigningSpecQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
    /** `enabled: undefined` falls through the `??` back to the default. */
    expect(getTpSlSigningSpecQueryOptions(config, { query: { enabled: undefined } }).enabled).toBe(true);
  });

  it("spreads caller-supplied query overrides onto the returned options", () => {
    const { config } = mockConfig();

    const options = getTpSlSigningSpecQueryOptions(config, {
      query: { staleTime: Infinity, gcTime: 60_000, retry: false },
    });

    expect(options.staleTime).toBe(Infinity);
    expect(options.gcTime).toBe(60_000);
    expect(options.retry).toBe(false);
    /** The factory still owns `queryKey` / `queryFn` / `enabled`. */
    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getTpSlSigningSpec");
    expect(typeof options.queryFn).toBe("function");
  });

  it("queryFn delegates to getTpSlSigningSpec", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));

    const spec = await getTpSlSigningSpecQueryOptions(config).queryFn();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(SPEC_PATH, EXPECTED_REQUEST);
    /** The action returns `response.data` by reference — no copy in between. */
    expect(spec).toBe(SIGNING_SPEC);
  });

  it("queryFn forwards the chainId and surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));

    const options = getTpSlSigningSpecQueryOptions(config, { chainId: mainnet.id });

    await expect(options.queryFn()).rejects.toThrow(SymmError);
    await expect(options.queryFn()).rejects.toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(get).not.toHaveBeenCalled();
  });

  it("builds a stable key", () => {
    const key = getTpSlSigningSpecQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      configKey: "fingerprint",
    });
    expect(key).toEqual([
      "getTpSlSigningSpec",
      { chainId: SymmioSupportedChainId.HYPER_EVM, configKey: "fingerprint" },
    ]);
  });

  it("keys the factory output on chainId + configKey only, dropping `query` and an absent chainId", () => {
    const { config } = mockConfig();

    const withChain = getTpSlSigningSpecQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
      query: { staleTime: Infinity },
    }).queryKey;
    const withoutChain = getTpSlSigningSpecQueryOptions(config).queryKey;

    expect(withChain).toEqual([
      "getTpSlSigningSpec",
      { chainId: SymmioSupportedChainId.HYPER_EVM, configKey: config.getChainConfigKey() },
    ]);
    /** `filterQueryOptions` strips `undefined`, so an omitted chainId leaves no key entry at all. */
    expect(withoutChain).toEqual(["getTpSlSigningSpec", { configKey: config.getChainConfigKey() }]);
  });

  it("never collides with the delete-spec key", () => {
    const parameters = { chainId: SymmioSupportedChainId.HYPER_EVM, configKey: "fingerprint" };

    expect(getTpSlSigningSpecQueryKey(parameters)[0]).toBe("getTpSlSigningSpec");
    expect(getTpSlSigningSpecQueryKey(parameters)).not.toEqual(getTpSlDeleteSigningSpecQueryKey(parameters));
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", async () => {
    const { config: base } = mockConfig();
    const overridden = overriddenConfig();

    const baseKey = getTpSlSigningSpecQueryOptions(base).queryKey;
    const overriddenKey = getTpSlSigningSpecQueryOptions(overridden).queryKey;

    expect(baseKey).toEqual(["getTpSlSigningSpec", { configKey: base.getChainConfigKey() }]);
    expect(overriddenKey).toEqual(["getTpSlSigningSpec", { configKey: overridden.getChainConfigKey() }]);
    expect(overridden.getChainConfigKey()).not.toBe(base.getChainConfigKey());

    /** The re-key is not cosmetic: the overridden config really does request a different host. */
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));
    await getTpSlSigningSpecQueryOptions(overridden).queryFn();
    expect(get).toHaveBeenCalledWith(SPEC_PATH, {
      baseURL: OVERRIDE_URL,
      headers: { "App-Name": TPSL.appName, Accept: "application/json" },
    });
  });
});
