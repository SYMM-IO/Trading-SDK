import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { simulateDeleteSubAccountMutationOptions } from "./simulate-delete-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateDeleteSubAccountMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(simulateDeleteSubAccountMutationOptions(config).mutationKey).toEqual(["simulateDeleteSubAccount"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    await simulateDeleteSubAccountMutationOptions(config).mutationFn({ subAccount: SUB_ACCOUNT, from: FROM });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "deleteSubAccount",
        args: [SUB_ACCOUNT],
        account: FROM,
      }),
    );
  });
});
