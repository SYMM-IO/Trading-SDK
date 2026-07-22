import type { Address, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { AffiliateState } from "../types";
import { getAffiliateStateQueryKey, getAffiliateStateQueryOptions } from "./get-affiliate-state";

const AFFILIATE: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";
const CUSTOM_SYMMIO: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("getAffiliateStateQueryOptions", () => {
  it("is disabled until `affiliate` is set", () => {
    const { config } = mockConfig();
    expect(getAffiliateStateQueryOptions(config, {}).enabled).toBe(false);
    expect(getAffiliateStateQueryOptions(config, { affiliate: AFFILIATE }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getAffiliateStateQueryOptions(config, { affiliate: AFFILIATE, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(AffiliateState.ACTIVE);

    const state = await getAffiliateStateQueryOptions(config, { affiliate: AFFILIATE }).queryFn();

    expect(state).toBe(AffiliateState.ACTIVE);
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getAffiliateState" }));
  });

  it("queryFn throws a SymmError synchronously when `affiliate` is missing", () => {
    const { config } = mockConfig();
    expect(() => getAffiliateStateQueryOptions(config, {}).queryFn()).toThrow(SymmError);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getAffiliateStateQueryOptions(config, { affiliate: AFFILIATE, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getAffiliateStateQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      affiliate: AFFILIATE,
    });
    expect(key).toEqual([
      "getAffiliateState",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        affiliate: AFFILIATE,
      },
    ]);
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", () => {
    const { config: base } = mockConfig();
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1", symmioAddress: CUSTOM_SYMMIO },
        },
      },
    });

    const baseKey = getAffiliateStateQueryOptions(base, { affiliate: AFFILIATE }).queryKey;
    const overriddenKey = getAffiliateStateQueryOptions(overridden, { affiliate: AFFILIATE }).queryKey;

    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect(overriddenKey).not.toEqual(baseKey);
  });
});
