import { erc20Abi, maxUint256, type Address, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../../shared/test/mock-config";
import { simulateApproveCollateralMutationOptions } from "./simulate-approve-collateral";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AMOUNT = 7_500000n;
const SENDER: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("simulateApproveCollateralMutationOptions", () => {
  it("builds a stable mutation key", () => {
    const { config } = mockConfig();

    expect(simulateApproveCollateralMutationOptions(config).mutationKey).toEqual(["simulateApproveCollateral"]);
  });

  it("mutationFn forwards its variables to the action and resolves viem's { request, result }", async () => {
    const { config, simulateContract } = mockConfig();
    const request = { functionName: "approve" };
    simulateContract.mockResolvedValueOnce({ result: true, request });

    const simulation = await simulateApproveCollateralMutationOptions(config).mutationFn({
      amount: AMOUNT,
      from: SENDER,
    });

    expect(simulation.result).toBe(true);
    expect(simulation.request).toBe(request);
    expect(simulateContract).toHaveBeenCalledWith({
      address: DEFAULT.addresses.collateralAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [DEFAULT.addresses.symmioAddress, AMOUNT],
      account: SENDER,
    });
  });

  it("passes `account: undefined` when `from` is omitted", async () => {
    const { config, simulateContract } = mockConfig();

    await simulateApproveCollateralMutationOptions(config).mutationFn({ amount: maxUint256 });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ args: [DEFAULT.addresses.symmioAddress, maxUint256], account: undefined }),
    );
  });

  it("needs only a public client — no wallet resolver required", async () => {
    const { config, simulateContract } = mockConfig({ withWallet: false });
    const simulation = { result: true, request: { functionName: "approve" } };
    simulateContract.mockResolvedValueOnce(simulation);

    await expect(simulateApproveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT })).resolves.toBe(
      simulation,
    );
    expect(simulateContract).toHaveBeenCalledTimes(1);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "approve",
        args: [DEFAULT.addresses.symmioAddress, AMOUNT],
      }),
    );
  });

  it("mutationFn uses the per-call chainId rather than the config default", async () => {
    const simulateContract = vi.fn().mockResolvedValue({ result: true, request: {} });
    const getClient = vi.fn(() => ({ simulateContract }) as unknown as PublicClient);
    /** An unsupported fallback chain makes the per-call `chainId` observable. */
    const config = createConfig({
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } },
      },
      getClient,
      defaultChainId: mainnet.id,
    });

    await expect(simulateApproveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT })).rejects.toMatchObject(
      { code: "UNSUPPORTED_CHAIN" },
    );
    expect(getClient).not.toHaveBeenCalled();

    await simulateApproveCollateralMutationOptions(config).mutationFn({
      amount: AMOUNT,
      chainId: SymmioSupportedChainId.HYPER_EVM,
    });

    expect(getClient).toHaveBeenCalledWith({ chainId: SymmioSupportedChainId.HYPER_EVM });
  });

  it("mutationFn rejects with UNSUPPORTED_CHAIN before reaching the client", async () => {
    const { config, simulateContract } = mockConfig();

    const promise = simulateApproveCollateralMutationOptions(config).mutationFn({
      amount: AMOUNT,
      chainId: mainnet.id,
    });

    await expect(promise).rejects.toBeInstanceOf(SymmError);
    await expect(promise).rejects.toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("mutationFn surfaces the viem revert when the approve would fail", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockRejectedValueOnce(new Error("would revert"));

    await expect(simulateApproveCollateralMutationOptions(config).mutationFn({ amount: AMOUNT })).rejects.toThrow(
      "would revert",
    );
  });
});
