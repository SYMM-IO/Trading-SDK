import { zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { VIRTUAL_ACCOUNT_ISOLATION_TYPE } from "../../../solvers/instant-open/shared/types";
import { getActiveVirtualAccountByKeyQueryOptions } from "../query/get-active-virtual-account-by-key";
import { getActiveVirtualAccountByKey } from "./get-active-virtual-account-by-key";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const VA: Address = "0x2222222222222222222222222222222222222222";
const KEY = { subAccount: TEST_USER, isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT, symbolId: 42n };

describe("getActiveVirtualAccountByKey", () => {
  it("reads getActiveVAByKey with the key in contract order", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(VA);

    const active = await getActiveVirtualAccountByKey(config, KEY);

    expect(active).toBe(VA);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getActiveVAByKey",
        args: [TEST_USER, VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT, 42n],
      }),
    );
  });

  it("returns null when no virtual account is active for the key", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(zeroAddress);

    expect(await getActiveVirtualAccountByKey(config, KEY)).toBeNull();
  });
});

describe("getActiveVirtualAccountByKeyQueryOptions", () => {
  it("stays disabled until the whole key is set, counting symbol id 0n as set", () => {
    const { config } = mockConfig();

    expect(getActiveVirtualAccountByKeyQueryOptions(config, { subAccount: TEST_USER }).enabled).toBe(false);
    expect(
      getActiveVirtualAccountByKeyQueryOptions(config, {
        subAccount: TEST_USER,
        isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.POSITION,
        symbolId: 0n,
      }).enabled,
    ).toBe(true);
  });
});
