import { decodeFunctionData, getAddress, type Hex } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH, TEST_USER } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { createClassicWithdrawPart } from "../parts";
import { executeAccountCalls } from "./execute-account-calls";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const SUB_ACCOUNT = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const CALLS = [
  {
    functionName: "initiateWithdraw",
    args: [
      [createClassicWithdrawPart({ id: 0n, amount: 1_000_001n, receiver: TEST_USER, chainId: BigInt(arbitrum.id) })],
      false,
      "0x1234",
    ],
  },
  { functionName: "finalizeWithdrawRequest", args: [SUB_ACCOUNT, 42n] },
];

describe("executeAccountCalls", () => {
  it("simulates and sends one ordered atomic call with exact withdrawal arguments", async () => {
    const { config, simulateContract, writeContract } = mockConfig();

    expect(await executeAccountCalls(config, { account: SUB_ACCOUNT, calls: CALLS, gasless: false })).toBe(
      TEST_TX_HASH,
    );

    expect(writeContract).toHaveBeenCalledTimes(1);
    const write = writeContract.mock.calls[0]![0];
    expect(write.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(write.functionName).toBe("_call");
    expect(write.args[0]).toBe(SUB_ACCOUNT);
    expect(write.args[1].map((data: Hex) => decodeFunctionData({ abi: symmioAbi, data }))).toEqual(
      CALLS.map((call) => ({ functionName: call.functionName, args: call.args })),
    );
    expect(simulateContract).toHaveBeenCalledWith(expect.objectContaining({ args: write.args }));
    expect(simulateContract.mock.invocationCallOrder[0]).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
  });

  it("does not submit any call if simulation fails", async () => {
    const { config, simulateContract, writeContract } = mockConfig();
    simulateContract.mockRejectedValueOnce(new Error("cooldown not over"));

    await expect(executeAccountCalls(config, { account: SUB_ACCOUNT, calls: CALLS })).rejects.toThrow(
      "cooldown not over",
    );
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(executeAccountCalls(config, { account: SUB_ACCOUNT, calls: CALLS })).rejects.toThrow(SymmError);
  });

  it("rejects an explicit non-owner on the wallet path without simulation or submission", async () => {
    const { config, readContract, simulateContract, writeContract } = mockConfig();
    readContract.mockResolvedValue({ isExists: true, owner: SUB_ACCOUNT });

    await expect(
      executeAccountCalls(config, { account: SUB_ACCOUNT, calls: CALLS, from: TEST_USER, gasless: false }),
    ).rejects.toMatchObject({ code: "WALLET_PATH_REQUIRES_OWNER" });
    expect(simulateContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it.each([
    [],
    [{ functionName: "balanceOf", args: [SUB_ACCOUNT] }],
    [{ functionName: "unknownMethod" }],
    [{ functionName: "allocate", args: [] }],
  ])("rejects an invalid batch before any client I/O: %j", async (...entries) => {
    const { config, readContract, writeContract, simulateContract } = mockConfig();

    await expect(executeAccountCalls(config, { account: SUB_ACCOUNT, calls: entries })).rejects.toThrow();
    expect(readContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
    expect(simulateContract).not.toHaveBeenCalled();
  });
});
