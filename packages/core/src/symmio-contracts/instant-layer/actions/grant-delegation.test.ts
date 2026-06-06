import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { grantDelegation } from "./grant-delegation";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

describe("grantDelegation", () => {
  it("writes grantDelegation to the InstantLayer", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await grantDelegation(config, {
      account: { addr: ACCOUNT, isPartyB: false },
      delegatedSigner: DELEGATE,
      selectors: [SELECTOR],
      expiryTimestamp: 456n,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "grantDelegation",
        args: [
          {
            account: { addr: ACCOUNT, isPartyB: false },
            delegatedSigner: DELEGATE,
            selectors: [SELECTOR],
            expiryTimestamp: 456n,
          },
        ],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(
      grantDelegation(config, {
        account: { addr: ACCOUNT, isPartyB: false },
        delegatedSigner: DELEGATE,
        selectors: [SELECTOR],
        expiryTimestamp: 456n,
      }),
    ).rejects.toThrow("no `getWalletClient` resolver");
  });
});
