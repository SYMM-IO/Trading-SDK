import type { Address, Hash, Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import { mockConfig, TEST_TX_HASH, TEST_USER } from "../../../shared/test/mock-config";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";
import { initiateRevokeDelegation } from "./initiate-revoke-delegation";

/**
 * The dispatcher is stubbed for one reason only: so the regression test at the
 * bottom of this file can prove the action never reaches for it.
 */
vi.mock("../../../gasless/dispatch/maybe-relay-as-gasless", () => ({ maybeRelayAsGasless: vi.fn() }));

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const CHAIN = SymmioSupportedChainId.ARBITRUM;
const ARBITRUM = getChainConfig(CHAIN);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";
/** A hash distinct from the stub wallet's default, so the pass-through is observable. */
const WRITE_HASH: Hash = `0x${"ee".repeat(32)}`;

const REVOKE = {
  account: { addr: ACCOUNT, isPartyB: false },
  delegate: DELEGATE,
  selectors: [SELECTOR],
} as const;

describe("initiateRevokeDelegation", () => {
  it("writes initiateRevokeDelegation to the InstantLayer as [account, delegate, selectors]", async () => {
    const { config, writeContract } = mockConfig();

    await initiateRevokeDelegation(config, REVOKE);

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        abi: instantLayerAbi,
        functionName: "initiateRevokeDelegation",
        args: [{ addr: ACCOUNT, isPartyB: false }, DELEGATE, [SELECTOR]],
        account: expect.objectContaining({ address: TEST_USER }),
      }),
    );
  });

  it("resolves the hash `writeContract` returned, untouched", async () => {
    const { config, writeContract } = mockConfig();
    writeContract.mockResolvedValueOnce(WRITE_HASH);

    await expect(initiateRevokeDelegation(config, REVOKE)).resolves.toBe(WRITE_HASH);
  });

  it("targets the per-call chain's InstantLayer rather than the config default", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await initiateRevokeDelegation(config, { ...REVOKE, chainId: CHAIN });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: ARBITRUM.addresses.instantLayerAddress }),
    );
  });

  it("forwards `from` to the wallet resolver so a session key can revoke itself", async () => {
    const { config } = mockConfig();
    const getWalletClient = vi.spyOn(config, "getWalletClient");

    await initiateRevokeDelegation(config, { ...REVOKE, chainId: CHAIN, from: DELEGATE });

    expect(getWalletClient).toHaveBeenCalledWith({ chainId: CHAIN, from: DELEGATE });

    await initiateRevokeDelegation(config, { ...REVOKE, chainId: CHAIN });

    expect(getWalletClient).toHaveBeenLastCalledWith({ chainId: CHAIN, from: undefined });
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(initiateRevokeDelegation(config, REVOKE)).rejects.toThrow("no `getWalletClient` resolver");
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await initiateRevokeDelegation(config, REVOKE);

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: DEFAULT.addresses.instantLayerAddress,
          abi: instantLayerAbi,
          functionName: "initiateRevokeDelegation",
          args: [{ addr: ACCOUNT, isPartyB: false }, DELEGATE, [SELECTOR]],
          /** The dry-run runs as the wallet the resolver returned, not as the `from` hint. */
          account: TEST_USER,
        }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await initiateRevokeDelegation(config, { ...REVOKE, simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalledOnce();
    });

    it("skips the dry-run when the config disables it globally", async () => {
      const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

      await initiateRevokeDelegation(config, REVOKE);

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalledOnce();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(initiateRevokeDelegation(config, REVOKE)).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });

  /**
   * Revocation can never be relayed. `InstantLayer._verifyOperation` sends every
   * signed operation whose `target` is the InstantLayer itself to
   * `_verifyGrantOperation` (perps-core v0.8.6,
   * `contracts/instantLayer/InstantLayer.sol:931-933`), and that helper reverts
   * `InvalidGrantOperation` for any selector other than `grantDelegation` /
   * `grantDelegations` (line 1128). A relayed `initiateRevokeDelegation` would
   * therefore always revert on-chain, so this action is a plain gas-paid wallet
   * write with no `gasless` option — do not restore the dispatcher seam here.
   */
  it("never consults the gasless dispatcher: a revocation targets the InstantLayer, which the contract accepts only as a grant", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await initiateRevokeDelegation(config, REVOKE);

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledOnce();
    expect(maybeRelayAsGasless).not.toHaveBeenCalled();
  });
});
