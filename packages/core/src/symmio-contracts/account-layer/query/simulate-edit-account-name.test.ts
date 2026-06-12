import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateEditAccountNameMutationOptions } from "./simulate-edit-account-name";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateEditAccountNameMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(simulateEditAccountNameMutationOptions(config).mutationKey).toEqual(["simulateEditAccountName"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, simulateContract } = mockConfig();

    await simulateEditAccountNameMutationOptions(config).mutationFn({
      account: SUB_ACCOUNT,
      name: "Main",
      from: FROM,
    });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "editAccountName",
        args: [SUB_ACCOUNT, "Main"],
        account: FROM,
      }),
    );
  });
});
