import type { Address, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS, TEST_USER } from "../../../shared/test/mock-config";
import { getCollateralBalanceQueryKey, getCollateralBalanceQueryOptions } from "./get-collateral-balance";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const CUSTOM_COLLATERAL: Address = "0xcccccccccccccccccccccccccccccccccccccccc";

describe("getCollateralBalanceQueryKey", () => {
  it("builds a stable key from the query parameters", () => {
    expect(getCollateralBalanceQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, owner: TEST_USER })).toEqual([
      "getCollateralBalance",
      { chainId: SymmioSupportedChainId.HYPER_EVM, owner: TEST_USER },
    ]);
  });

  it("drops `undefined` parameters so an unset chain id does not change the key", () => {
    expect(getCollateralBalanceQueryKey({ chainId: undefined, owner: TEST_USER })).toEqual([
      "getCollateralBalance",
      { owner: TEST_USER },
    ]);
  });

  it("is callable with no options", () => {
    expect(getCollateralBalanceQueryKey()).toEqual(["getCollateralBalance", {}]);
  });
});

describe("getCollateralBalanceQueryOptions", () => {
  it("is disabled until `owner` is set", () => {
    const { config } = mockConfig();

    expect(getCollateralBalanceQueryOptions(config, {}).enabled).toBe(false);
    expect(getCollateralBalanceQueryOptions(config, { owner: TEST_USER }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override even with `owner` set", () => {
    const { config } = mockConfig();

    expect(getCollateralBalanceQueryOptions(config, { owner: TEST_USER, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("keeps the missing-owner gate even when the consumer forces `query.enabled: true`", () => {
    const { config } = mockConfig();

    expect(getCollateralBalanceQueryOptions(config, { query: { enabled: true } }).enabled).toBe(false);
    expect(getCollateralBalanceQueryOptions(config, { owner: TEST_USER, query: { enabled: true } }).enabled).toBe(true);
  });

  it("is callable with no options at all", () => {
    const { config } = mockConfig();

    const options = getCollateralBalanceQueryOptions(config);

    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual(["getCollateralBalance", { configKey: config.getChainConfigKey() }]);
  });

  it("merges consumer query overrides into the returned options", () => {
    const { config } = mockConfig();

    const options = getCollateralBalanceQueryOptions(config, {
      owner: TEST_USER,
      chainId: SymmioSupportedChainId.HYPER_EVM,
      query: { staleTime: 15_000 },
    });

    expect(options.staleTime).toBe(15_000);
    /** Control fields never leak into the key — same cache entry regardless of staleTime. */
    expect(options.queryKey).toEqual([
      "getCollateralBalance",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        owner: TEST_USER,
        configKey: config.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM),
      },
    ]);
  });

  it("queryFn delegates to the action and returns its value", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(9_876543n);

    const balance = await getCollateralBalanceQueryOptions(config, { owner: TEST_USER }).queryFn();

    expect(balance).toBe(9_876543n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "balanceOf",
        args: [TEST_USER],
      }),
    );
  });

  it("queryFn throws MISSING_OWNER synchronously when invoked without an owner", () => {
    const { config, readContract } = mockConfig();
    const options = getCollateralBalanceQueryOptions(config, {});

    /** The factory's queryFn is not `async`, so the validation guard throws before a promise exists. */
    let thrown: unknown;
    try {
      options.queryFn();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SymmError);
    expect(thrown).toMatchObject({
      kind: "validation",
      code: "MISSING_OWNER",
      message: "getCollateralBalance: `owner` is required.",
    });
    expect(readContract).not.toHaveBeenCalled();
  });

  it("queryFn surfaces a SymmError for an unsupported chain even though `owner` is set", async () => {
    const { config, readContract } = mockConfig();
    const options = getCollateralBalanceQueryOptions(config, { owner: TEST_USER, chainId: mainnet.id });

    /** Documented contract: a bad chain rejects from the queryFn, it does not silently disable the query. */
    expect(options.enabled).toBe(true);
    await expect(options.queryFn()).rejects.toMatchObject({
      kind: "config",
      code: "UNSUPPORTED_CHAIN",
      message: `Unsupported chain id: ${mainnet.id}.`,
    });
    await expect(options.queryFn()).rejects.toBeInstanceOf(SymmError);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", () => {
    const { config: base } = mockConfig();
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS, collateralAddress: CUSTOM_COLLATERAL },
        },
      },
    });

    const baseKey = getCollateralBalanceQueryOptions(base, { owner: TEST_USER }).queryKey;
    const overriddenKey = getCollateralBalanceQueryOptions(overridden, { owner: TEST_USER }).queryKey;

    expect(overridden.getChainConfig().addresses.collateralAddress).toBe(CUSTOM_COLLATERAL);
    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect((overriddenKey[1] as { configKey?: string }).configKey).toBe(overridden.getChainConfigKey());
    expect(overriddenKey).not.toEqual(baseKey);
  });
});
