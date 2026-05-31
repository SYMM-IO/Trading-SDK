import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../chains";
import { SymmError } from "../../errors";
import { mockConfig, TEST_TX_HASH } from "../../test/mock-config";
import { editAccountName } from "./edit-account-name";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("editAccountName", () => {
  it("writes editAccountName to the AccountLayer", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await editAccountName(config, { account: SUB_ACCOUNT, name: "Main" });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "editAccountName",
        args: [SUB_ACCOUNT, "Main"],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(editAccountName(config, { account: SUB_ACCOUNT, name: "Main" })).rejects.toThrow(SymmError);
  });
});
