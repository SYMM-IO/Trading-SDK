import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { grantDelegation } from "./grant-delegation";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";
const DELEGATION = {
  account: { addr: ACCOUNT, isPartyB: false },
  delegatedSigner: DELEGATE,
  selectors: [SELECTOR],
  expiryTimestamp: 456n,
};

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

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await grantDelegation(config, DELEGATION);

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "grantDelegation", args: [DELEGATION] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await grantDelegation(config, { ...DELEGATION, simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("skips the dry-run when the config disables it globally", async () => {
      const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

      await grantDelegation(config, DELEGATION);

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(grantDelegation(config, DELEGATION)).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
