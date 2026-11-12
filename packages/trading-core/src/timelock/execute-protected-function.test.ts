import { decodeFunctionData, getAbiItem, type Abi, type AbiFunction, type AbiParameter } from "viem";
import { describe, expect, it, vi } from "vitest";
import { mockConfig, TEST_TX_HASH, TEST_USER } from "../shared/test/mock-config";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";
import { executeProtectedCall } from "./execute-protected-call";
import { executeProtectedFunction, type ExecuteProtectedFunctionParameters } from "./execute-protected-function";
import { INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS, INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS } from "./policy";

vi.mock("./execute-protected-call", async (original) => ({
  ...(await original<typeof import("./execute-protected-call")>()),
  executeProtectedCall: vi.fn().mockResolvedValue(TEST_TX_HASH),
}));

function example(parameter: AbiParameter): unknown {
  const array = parameter.type.match(/^(.*)\[(\d*)\]$/);
  if (array)
    return Array.from({ length: array[2] ? Number(array[2]) : 0 }, () =>
      example({ ...parameter, type: array[1]! } as AbiParameter),
    );
  if (parameter.type === "tuple" && "components" in parameter) return parameter.components.map(example);
  if (parameter.type === "address") return TEST_USER;
  if (parameter.type === "bool") return false;
  if (parameter.type === "string") return "test";
  if (parameter.type === "bytes") return "0x";
  if (parameter.type.startsWith("bytes")) return `0x${"11".repeat(Number(parameter.type.slice(5)))}`;
  return 1n;
}

describe("protected named operations", () => {
  it("rejects an AccountLayer function targeting a different account before issuance", async () => {
    vi.mocked(executeProtectedCall).mockClear();
    const parameters = {
      account: TEST_USER,
      target: "account-layer",
      functionName: "addMargin",
      args: ["0x0000000000000000000000000000000000000001", 1n],
      timelock: { approval: {} },
    } as unknown as ExecuteProtectedFunctionParameters;
    await expect(executeProtectedFunction(mockConfig().config, parameters)).rejects.toMatchObject({
      code: "TIMELOCK_ACCOUNT_MISMATCH",
    });
    expect(executeProtectedCall).not.toHaveBeenCalled();
  });
  it.each([
    ...INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS.map((name) => ({ name, target: "core" as const, abi: symmioAbi as Abi })),
    ...INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS.map((name) => ({
      name,
      target: "account-layer" as const,
      abi: accountLayerAbi as Abi,
    })),
  ])("encodes $target.$name from its pinned ABI and preserves the target", async ({ name, target, abi }) => {
    const item = getAbiItem({ abi, name }) as AbiFunction;
    const args = item.inputs.map(example);
    const parameters = {
      account: TEST_USER,
      target,
      functionName: name,
      args,
      timelock: { approval: {} },
    } as unknown as ExecuteProtectedFunctionParameters;
    await executeProtectedFunction(mockConfig().config, parameters);
    const [, forwarded] = vi.mocked(executeProtectedCall).mock.lastCall!;
    expect(forwarded.target).toBe(target);
    expect(decodeFunctionData({ abi, data: forwarded.callData }).functionName).toBe(name);
  });
});
