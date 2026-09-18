import { encodeAbiParameters, encodeEventTopics, type Address, type TransactionReceipt } from "viem";
import { describe, expect, it } from "vitest";
import { SymmError } from "../shared/errors/symm-error";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";
import { getWithdrawRequestIdFromReceipt } from "./get-withdraw-request-id-from-receipt";
import { TEST_ACCOUNT } from "./test-fixtures";

const SYMMIO: Address = "0x4444444444444444444444444444444444444444";

function withdrawalLog(requestId: bigint, user: Address, address: Address = SYMMIO) {
  return {
    address,
    topics: encodeEventTopics({ abi: symmioAbi, eventName: "WithdrawInitiated", args: { requestId, user } }),
    data: encodeAbiParameters(
      [
        {
          type: "tuple[]",
          components: [
            { name: "id", type: "uint256" },
            { name: "amount", type: "uint256" },
            { name: "chainId", type: "int256" },
            { name: "receiver", type: "bytes" },
            { name: "virtualProvider", type: "address" },
            { name: "expressProvider", type: "address" },
          ],
        },
        { type: "bool" },
        { type: "bytes" },
        { type: "uint256" },
      ],
      [[], false, "0x", 123n],
    ),
  };
}

function receipt(logs: ReturnType<typeof withdrawalLog>[]): TransactionReceipt {
  return { status: "success", logs } as unknown as TransactionReceipt;
}

describe("getWithdrawRequestIdFromReceipt", () => {
  it("extracts the matching user's exact id and ignores other contracts/users", () => {
    const otherUser = "0x5555555555555555555555555555555555555555" as const;
    const otherContract = "0x6666666666666666666666666666666666666666" as const;

    expect(
      getWithdrawRequestIdFromReceipt(
        receipt([
          withdrawalLog(1n, otherUser),
          withdrawalLog(2n, TEST_ACCOUNT, otherContract),
          withdrawalLog(17n, TEST_ACCOUNT),
        ]),
        { user: TEST_ACCOUNT, symmioAddress: SYMMIO },
      ),
    ).toBe(17n);
  });

  it.each([
    ["WITHDRAW_INITIATED_EVENT_NOT_FOUND", []],
    ["WITHDRAW_INITIATED_EVENT_AMBIGUOUS", [withdrawalLog(1n, TEST_ACCOUNT), withdrawalLog(2n, TEST_ACCOUNT)]],
  ])("throws %s instead of guessing", (code, logs) => {
    const rejection = (() => {
      try {
        getWithdrawRequestIdFromReceipt(receipt(logs), { user: TEST_ACCOUNT, symmioAddress: SYMMIO });
      } catch (error) {
        return error;
      }
    })();

    expect(rejection).toBeInstanceOf(SymmError);
    expect((rejection as SymmError).code).toBe(code);
  });

  it("rejects a reverted receipt before inspecting logs", () => {
    const reverted = { ...receipt([withdrawalLog(17n, TEST_ACCOUNT)]), status: "reverted" } as TransactionReceipt;

    const rejection = (() => {
      try {
        getWithdrawRequestIdFromReceipt(reverted, { user: TEST_ACCOUNT, symmioAddress: SYMMIO });
      } catch (error) {
        return error;
      }
    })();

    expect(rejection).toBeInstanceOf(SymmError);
    expect((rejection as SymmError).code).toBe("WITHDRAW_RECEIPT_REVERTED");
  });
});
