import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getDeallocateDebounceTimeQueryOptions } from "./query";

describe("getDeallocateDebounceTimeQueryOptions", () => {
  it("scopes query data to the deployment and preserves query overrides", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValue(30n);
    const query = getDeallocateDebounceTimeQueryOptions(config, { query: { enabled: false, staleTime: 1000 } });
    expect(query.enabled).toBe(false);
    expect(query.staleTime).toBe(1000);
    expect(query.queryKey[1]).toMatchObject({ configKey: config.getChainConfigKey() });
    expect(await query.queryFn()).toBe(30n);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const query = getDeallocateDebounceTimeQueryOptions(config, { chainId: mainnet.id });
    await expect(query.queryFn()).rejects.toThrow(SymmError);
  });
});
