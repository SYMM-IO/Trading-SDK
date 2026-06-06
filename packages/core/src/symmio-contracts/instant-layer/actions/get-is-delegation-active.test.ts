import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getIsDelegationActive } from "./get-is-delegation-active";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

describe("getIsDelegationActive", () => {
  it("reads delegation active status from the InstantLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(true);

    const result = await getIsDelegationActive(config, { account: ACCOUNT, delegate: DELEGATE, selector: SELECTOR });

    expect(result).toBe(true);
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "isDelegationActive",
        args: [ACCOUNT, DELEGATE, SELECTOR],
      }),
    );
  });
});
