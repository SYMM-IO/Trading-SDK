import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getWithdrawCooldownOfQueryOptions } from "./query";

describe("getWithdrawCooldownOfQueryOptions", () => {
  it("scopes query data to the deployment and preserves query overrides", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValue(30n);
    const query = getWithdrawCooldownOfQueryOptions(config, {
      user: TEST_USER,
      query: { enabled: false, staleTime: 1000 },
    });
    expect(query.enabled).toBe(false);
    expect(query.staleTime).toBe(1000);
    expect(query.queryKey[1]).toMatchObject({ user: TEST_USER, configKey: config.getChainConfigKey() });
    expect(await query.queryFn()).toBe(30n);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const query = getWithdrawCooldownOfQueryOptions(config, { user: TEST_USER, chainId: mainnet.id });
    await expect(query.queryFn()).rejects.toThrow(SymmError);
  });
});
