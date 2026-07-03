import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getDelegationExpiry } from "./get-delegation-expiry";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

describe("getDelegationExpiry", () => {
  it("reads delegation expiry from the InstantLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(123n);

    const result = await getDelegationExpiry(config, { account: ACCOUNT, delegate: DELEGATE, selector: SELECTOR });

    expect(result).toBe(123n);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "delegations",
        args: [ACCOUNT, DELEGATE, SELECTOR],
      }),
    );
  });
});
