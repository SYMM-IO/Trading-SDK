import { maxUint256, type Account, type Address, type Chain, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig, type SymmioWalletClient } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS, TEST_TX_HASH, TEST_USER } from "../../../shared/test/mock-config";
import { approveCollateralMutationOptions } from "./approve-collateral";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AMOUNT = 25_000000n;
/** A signer hint distinct from the stub wallet's own account, so `from` routing is observable. */
const SENDER: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/**
 * A config whose wallet resolver is a spy — `mockConfig`'s resolver ignores its
 * arguments, so this variant is needed to observe what the action forwards to it.
 *
 * @param defaultChainId - Overrides the config's fallback chain. Pointing it at an
 *   unsupported chain makes the per-call `chainId` observable: without one the call
 *   fails on `UNSUPPORTED_CHAIN`, so a passing call proves the parameter was used
 *   rather than the (identical) built-in default.
 */
function spyWalletConfig(defaultChainId?: number) {
  const writeContract = vi.fn().mockResolvedValue(TEST_TX_HASH);
  const simulateContract = vi.fn().mockResolvedValue({ result: true, request: {} });
  const walletClient = {
    account: { address: TEST_USER, type: "json-rpc" } as Account,
    chain: { id: SymmioSupportedChainId.HYPER_EVM } as Chain,
    writeContract,
  } as unknown as SymmioWalletClient;
  const getWalletClient = vi.fn(async () => walletClient);
  const config = createConfig({
    symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } } },
    getClient: () => ({ simulateContract }) as unknown as PublicClient,
    getWalletClient,
    defaultChainId,
  });

  return { config, getWalletClient, writeContract, simulateContract };
}

describe("approveCollateralMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();

    expect(approveCollateralMutationOptions(config).mutationKey).toEqual(["approveCollateral"]);
  });

  it("mutationFn forwards its variables to the action and resolves the tx hash", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "approve",
        args: [DEFAULT.addresses.symmioAddress, AMOUNT],
      }),
    );
  });

  it("forwards the amount verbatim — there is no implicit max-approval default", async () => {
    const { config, writeContract } = mockConfig();

    await approveCollateralMutationOptions(config).mutationFn({ amount: maxUint256 });

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: [DEFAULT.addresses.symmioAddress, maxUint256] }),
    );
  });

  it("dry-runs the approve before writing by default", async () => {
    const { config, writeContract, simulateContract } = mockConfig();

    await approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "approve",
        args: [DEFAULT.addresses.symmioAddress, AMOUNT],
      }),
    );
    expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
  });

  it("skips the dry-run when the call passes `simulateBeforeWrite: false`", async () => {
    const { config, writeContract, simulateContract } = mockConfig();

    await approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT, simulateBeforeWrite: false });

    expect(simulateContract).not.toHaveBeenCalled();
    expect(writeContract).toHaveBeenCalledTimes(1);
  });

  it("skips the dry-run when the config disables it globally", async () => {
    const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

    await approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT });

    expect(simulateContract).not.toHaveBeenCalled();
    expect(writeContract).toHaveBeenCalledTimes(1);
  });

  it("aborts the write and rejects when the dry-run would revert", async () => {
    const { config, writeContract, simulateContract } = mockConfig();
    simulateContract.mockRejectedValueOnce(new Error("would revert"));

    await expect(approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT })).rejects.toThrow(
      "would revert",
    );
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("mutationFn routes `from` to the wallet resolver and dry-runs as the resolved account", async () => {
    const { config, getWalletClient, simulateContract } = spyWalletConfig();

    await approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT, from: SENDER });

    expect(getWalletClient).toHaveBeenCalledWith({ chainId: SymmioSupportedChainId.HYPER_EVM, from: SENDER });
    /** The pre-flight runs as the wallet the resolver actually returned, not as the `from` hint. */
    expect(simulateContract).toHaveBeenCalledWith(expect.objectContaining({ account: TEST_USER }));
  });

  it("mutationFn uses the per-call chainId rather than the config default", async () => {
    const { config, getWalletClient, writeContract } = spyWalletConfig(mainnet.id);

    /** The config's fallback chain is unsupported, so omitting `chainId` cannot resolve. */
    await expect(approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT })).rejects.toMatchObject({
      code: "UNSUPPORTED_CHAIN",
    });
    expect(getWalletClient).not.toHaveBeenCalled();

    const hash = await approveCollateralMutationOptions(config).mutationFn({
      amount: AMOUNT,
      chainId: SymmioSupportedChainId.HYPER_EVM,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(getWalletClient).toHaveBeenCalledWith({ chainId: SymmioSupportedChainId.HYPER_EVM, from: undefined });
    expect(writeContract).toHaveBeenCalledTimes(1);
  });

  it("mutationFn rejects with UNSUPPORTED_CHAIN before touching the wallet", async () => {
    const { config, getWalletClient } = spyWalletConfig();

    const promise = approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT, chainId: mainnet.id });

    await expect(promise).rejects.toBeInstanceOf(SymmError);
    await expect(promise).rejects.toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(getWalletClient).not.toHaveBeenCalled();
  });

  it("mutationFn rejects with NO_WALLET_CLIENT before the pre-flight when there is no wallet resolver", async () => {
    const { config, simulateContract } = mockConfig({ withWallet: false });

    const promise = approveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT });

    await expect(promise).rejects.toBeInstanceOf(SymmError);
    await expect(promise).rejects.toMatchObject({ kind: "config", code: "NO_WALLET_CLIENT" });
    /** The wallet is resolved first, so the dry-run never runs for a wallet-less config. */
    expect(simulateContract).not.toHaveBeenCalled();
  });
});
