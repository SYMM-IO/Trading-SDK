import axios, { type AxiosResponse } from "axios";
import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../shared/test/mock-config";
import type { TpSlSigningSpec } from "../types";
import { getTpSlDeleteSigningSpecQueryKey, getTpSlDeleteSigningSpecQueryOptions } from "./delete-query";
import { getTpSlSigningSpecQueryKey } from "./query";

const TPSL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.tpsl!;
const DELETE_SPEC_PATH = "/api/v5/signing-spec-del";
/** The exact axios request config the action builds from the chain's tpsl block. */
const EXPECTED_REQUEST = {
  baseURL: TPSL.url,
  headers: { "App-Name": TPSL.appName, Accept: "application/json" },
};
/** Base URL a caller-supplied chain override swaps in — proves the fingerprint tracks real config. */
const OVERRIDE_URL = "https://tpsl.override.test";

const DELETE_SIGNING_SPEC: TpSlSigningSpec = {
  domain: {
    name: "SymmioConditionalOrder",
    version: "1",
    chainId: SymmioSupportedChainId.HYPER_EVM,
    verifyingContract: TPSL.cohWalletAddress,
  },
  types: {
    CancelConditionalOrder: [
      { name: "virtualAccount", type: "address" },
      { name: "cohQuoteId", type: "string" },
    ],
  },
  primaryType: "CancelConditionalOrder",
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
        solver: { tpsl: { url: OVERRIDE_URL } },
      },
    },
  });
}

describe("getTpSlDeleteSigningSpecQueryOptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is enabled by default", () => {
    const { config } = mockConfig();
    expect(getTpSlDeleteSigningSpecQueryOptions(config).enabled).toBe(true);
    expect(getTpSlDeleteSigningSpecQueryOptions(config, { chainId: SymmioSupportedChainId.HYPER_EVM }).enabled).toBe(
      true,
    );
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getTpSlDeleteSigningSpecQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
    /** `enabled: undefined` falls through the `??` back to the default. */
    expect(getTpSlDeleteSigningSpecQueryOptions(config, { query: { enabled: undefined } }).enabled).toBe(true);
  });

  it("spreads caller-supplied query overrides onto the returned options", () => {
    const { config } = mockConfig();

    const options = getTpSlDeleteSigningSpecQueryOptions(config, {
      query: { staleTime: Infinity, gcTime: 60_000, retry: false },
    });

    expect(options.staleTime).toBe(Infinity);
    expect(options.gcTime).toBe(60_000);
    expect(options.retry).toBe(false);
    /** The factory still owns `queryKey` / `queryFn` / `enabled`. */
    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getTpSlDeleteSigningSpec");
    expect(typeof options.queryFn).toBe("function");
  });

  it("queryFn delegates to getTpSlDeleteSigningSpec", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(DELETE_SIGNING_SPEC));

    const spec = await getTpSlDeleteSigningSpecQueryOptions(config).queryFn();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(DELETE_SPEC_PATH, EXPECTED_REQUEST);
    /** The action returns `response.data` by reference — no copy in between. */
    expect(spec).toBe(DELETE_SIGNING_SPEC);
  });

  it("queryFn forwards the chainId and surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(DELETE_SIGNING_SPEC));

    const options = getTpSlDeleteSigningSpecQueryOptions(config, { chainId: mainnet.id });

    await expect(options.queryFn()).rejects.toThrow(SymmError);
    await expect(options.queryFn()).rejects.toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(get).not.toHaveBeenCalled();
  });

  it("builds a stable key", () => {
    const key = getTpSlDeleteSigningSpecQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      configKey: "fingerprint",
    });
    expect(key).toEqual([
      "getTpSlDeleteSigningSpec",
      { chainId: SymmioSupportedChainId.HYPER_EVM, configKey: "fingerprint" },
    ]);
  });

  it("keys the factory output on chainId + configKey only, dropping `query` and an absent chainId", () => {
    const { config } = mockConfig();

    const withChain = getTpSlDeleteSigningSpecQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
      query: { staleTime: Infinity },
    }).queryKey;
    const withoutChain = getTpSlDeleteSigningSpecQueryOptions(config).queryKey;

    expect(withChain).toEqual([
      "getTpSlDeleteSigningSpec",
      { chainId: SymmioSupportedChainId.HYPER_EVM, configKey: config.getChainConfigKey() },
    ]);
    /** `filterQueryOptions` strips `undefined`, so an omitted chainId leaves no key entry at all. */
    expect(withoutChain).toEqual(["getTpSlDeleteSigningSpec", { configKey: config.getChainConfigKey() }]);
  });

  it("never collides with the POST-spec key", () => {
    const parameters = { chainId: SymmioSupportedChainId.HYPER_EVM, configKey: "fingerprint" };

    expect(getTpSlDeleteSigningSpecQueryKey(parameters)[0]).toBe("getTpSlDeleteSigningSpec");
    expect(getTpSlDeleteSigningSpecQueryKey(parameters)).not.toEqual(getTpSlSigningSpecQueryKey(parameters));
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", async () => {
    const { config: base } = mockConfig();
    const overridden = overriddenConfig();

    const baseKey = getTpSlDeleteSigningSpecQueryOptions(base).queryKey;
    const overriddenKey = getTpSlDeleteSigningSpecQueryOptions(overridden).queryKey;

    expect(baseKey).toEqual(["getTpSlDeleteSigningSpec", { configKey: base.getChainConfigKey() }]);
    expect(overriddenKey).toEqual(["getTpSlDeleteSigningSpec", { configKey: overridden.getChainConfigKey() }]);
    expect(overridden.getChainConfigKey()).not.toBe(base.getChainConfigKey());

    /** The re-key is not cosmetic: the overridden config really does request a different host. */
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(DELETE_SIGNING_SPEC));
    await getTpSlDeleteSigningSpecQueryOptions(overridden).queryFn();
    expect(get).toHaveBeenCalledWith(DELETE_SPEC_PATH, {
      baseURL: OVERRIDE_URL,
      headers: { "App-Name": TPSL.appName, Accept: "application/json" },
    });
  });
});
