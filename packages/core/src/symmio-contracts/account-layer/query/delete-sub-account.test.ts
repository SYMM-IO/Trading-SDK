import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { deleteSubAccountMutationOptions } from "./delete-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("deleteSubAccountMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(deleteSubAccountMutationOptions(config).mutationKey).toEqual(["deleteSubAccount"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await deleteSubAccountMutationOptions(config).mutationFn({ subAccount: SUB_ACCOUNT });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "deleteSubAccount",
        args: [SUB_ACCOUNT],
      }),
    );
  });
});
