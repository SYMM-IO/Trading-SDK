import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { editAccountNameMutationOptions } from "./edit-account-name";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("editAccountNameMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();
    expect(editAccountNameMutationOptions(config).mutationKey).toEqual(["editAccountName"]);
  });

  it("mutationFn delegates to the action", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await editAccountNameMutationOptions(config).mutationFn({ account: SUB_ACCOUNT, name: "Main" });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "editAccountName",
        args: [SUB_ACCOUNT, "Main"],
      }),
    );
  });
});
