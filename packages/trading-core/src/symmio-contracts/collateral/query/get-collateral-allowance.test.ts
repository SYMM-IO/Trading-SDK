import type { Address, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS, TEST_USER } from "../../../shared/test/mock-config";
import { getCollateralAllowanceQueryKey, getCollateralAllowanceQueryOptions } from "./get-collateral-allowance";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const CUSTOM_COLLATERAL: Address = "0xcccccccccccccccccccccccccccccccccccccccc";

describe("getCollateralAllowanceQueryKey", () => {
  it("builds a stable key from the query parameters", () => {
    expect(getCollateralAllowanceQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, owner: TEST_USER })).toEqual([
      "getCollateralAllowance",
      { chainId: SymmioSupportedChainId.HYPER_EVM, owner: TEST_USER },
    ]);
  });

  it("drops `undefined` parameters so an unset chain id does not change the key", () => {
    expect(getCollateralAllowanceQueryKey({ chainId: undefined, owner: TEST_USER })).toEqual([
      "getCollateralAllowance",
      { owner: TEST_USER },
    ]);
  });

  it("is callable with no options", () => {
    expect(getCollateralAllowanceQueryKey()).toEqual(["getCollateralAllowance", {}]);
  });
});

describe("getCollateralAllowanceQueryOptions", () => {
  it("is disabled until `owner` is set", () => {
    const { config } = mockConfig();

    expect(getCollateralAllowanceQueryOptions(config, {}).enabled).toBe(false);
    expect(getCollateralAllowanceQueryOptions(config, { owner: TEST_USER }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override even with `owner` set", () => {
    const { config } = mockConfig();

    expect(getCollateralAllowanceQueryOptions(config, { owner: TEST_USER, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("keeps the missing-owner gate even when the consumer forces `query.enabled: true`", () => {
    const { config } = mockConfig();

    expect(getCollateralAllowanceQueryOptions(config, { query: { enabled: true } }).enabled).toBe(false);
    expect(getCollateralAllowanceQueryOptions(config, { owner: TEST_USER, query: { enabled: true } }).enabled).toBe(
      true,
    );
  });

  it("is callable with no options at all", () => {
    const { config } = mockConfig();

    const options = getCollateralAllowanceQueryOptions(config);

    expect(options.enabled).toBe(false);
    expect(options.queryKey).toEqual(["getCollateralAllowance", { configKey: config.getChainConfigKey() }]);
  });

  it("merges consumer query overrides into the returned options", () => {
    const { config } = mockConfig();

    const options = getCollateralAllowanceQueryOptions(config, {
      owner: TEST_USER,
      chainId: SymmioSupportedChainId.HYPER_EVM,
      query: { staleTime: 30_000 },
    });

    expect(options.staleTime).toBe(30_000);
    /** Control fields never leak into the key — same cache entry regardless of staleTime. */
    expect(options.queryKey).toEqual([
      "getCollateralAllowance",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        owner: TEST_USER,
        configKey: config.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM),
      },
    ]);
  });

  it("queryFn delegates to the action and returns its value", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(4_200000n);

    const allowance = await getCollateralAllowanceQueryOptions(config, { owner: TEST_USER }).queryFn();

    expect(allowance).toBe(4_200000n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "allowance",
        args: [TEST_USER, DEFAULT.addresses.symmioAddress],
      }),
    );
  });

  it("queryFn throws MISSING_OWNER synchronously when invoked without an owner", () => {
    const { config, readContract } = mockConfig();
    const options = getCollateralAllowanceQueryOptions(config, {});

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
      message: "getCollateralAllowance: `owner` is required.",
    });
    expect(readContract).not.toHaveBeenCalled();
  });

  it("queryFn surfaces a SymmError for an unsupported chain even though `owner` is set", async () => {
    const { config, readContract } = mockConfig();
    const options = getCollateralAllowanceQueryOptions(config, { owner: TEST_USER, chainId: mainnet.id });

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

    const baseKey = getCollateralAllowanceQueryOptions(base, { owner: TEST_USER }).queryKey;
    const overriddenKey = getCollateralAllowanceQueryOptions(overridden, { owner: TEST_USER }).queryKey;

    expect(overridden.getChainConfig().addresses.collateralAddress).toBe(CUSTOM_COLLATERAL);
    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect((overriddenKey[1] as { configKey?: string }).configKey).toBe(overridden.getChainConfigKey());
    expect(overriddenKey).not.toEqual(baseKey);
  });
});
