import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getSubAccount } from "./get-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("getSubAccount", () => {
  it("reads getSubAccount from the AccountLayer", async () => {
    const { config, readContract } = mockConfig();

    await getSubAccount(config, { account: SUB_ACCOUNT });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getSubAccount",
        args: [SUB_ACCOUNT],
      }),
    );
  });
});
