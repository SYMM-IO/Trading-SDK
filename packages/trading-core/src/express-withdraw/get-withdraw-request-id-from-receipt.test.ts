import { encodeAbiParameters, encodeEventTopics, type Address, type TransactionReceipt } from "viem";
import { describe, expect, it } from "vitest";
import { SymmError } from "../shared/errors/symm-error";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";
import { getWithdrawRequestIdFromReceipt } from "./get-withdraw-request-id-from-receipt";
import { TEST_ACCOUNT } from "./test-fixtures";

const SYMMIO: Address = "0x4444444444444444444444444444444444444444";
const OTHER_USER: Address = "0x5555555555555555555555555555555555555555";
const OTHER_CONTRACT: Address = "0x6666666666666666666666666666666666666666";

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

function finalizedLog(requestId: bigint, user: Address, address: Address = SYMMIO) {
  return {
    address,
    topics: encodeEventTopics({ abi: symmioAbi, eventName: "WithdrawFinalized", args: { requestId, user } }),
    data: "0x" as const,
  };
}

function receipt(logs: (ReturnType<typeof withdrawalLog> | ReturnType<typeof finalizedLog>)[]): TransactionReceipt {
  return { status: "success", logs } as unknown as TransactionReceipt;
}

function rejectionOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to throw.");
}

describe("getWithdrawRequestIdFromReceipt", () => {
  it("extracts the matching user's exact id and ignores other contracts/users", () => {
    expect(
      getWithdrawRequestIdFromReceipt(
        receipt([
          withdrawalLog(1n, OTHER_USER),
          withdrawalLog(2n, TEST_ACCOUNT, OTHER_CONTRACT),
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
    const rejection = rejectionOf(() =>
      getWithdrawRequestIdFromReceipt(receipt(logs), { user: TEST_ACCOUNT, symmioAddress: SYMMIO }),
    );

    expect(rejection).toBeInstanceOf(SymmError);
    expect((rejection as SymmError).code).toBe(code);
  });

  it("rejects a reverted receipt before inspecting logs", () => {
    const reverted = { ...receipt([withdrawalLog(17n, TEST_ACCOUNT)]), status: "reverted" } as TransactionReceipt;

    const rejection = rejectionOf(() =>
      getWithdrawRequestIdFromReceipt(reverted, { user: TEST_ACCOUNT, symmioAddress: SYMMIO }),
    );

    expect(rejection).toBeInstanceOf(SymmError);
    expect((rejection as SymmError).code).toBe("WITHDRAW_RECEIPT_REVERTED");
  });

  describe("requireFinalized", () => {
    const parameters = { user: TEST_ACCOUNT, symmioAddress: SYMMIO, requireFinalized: true } as const;

    it("returns the id when the same transaction finalized the request it initiated", () => {
      expect(
        getWithdrawRequestIdFromReceipt(
          receipt([withdrawalLog(10n, TEST_ACCOUNT), finalizedLog(10n, TEST_ACCOUNT)]),
          parameters,
        ),
      ).toBe(10n);
    });

    it("throws WITHDRAW_REQUEST_NOT_FINALIZED naming both ids when another request was finalized instead", () => {
      const rejection = rejectionOf(() =>
        getWithdrawRequestIdFromReceipt(
          receipt([withdrawalLog(10n, TEST_ACCOUNT), finalizedLog(9n, TEST_ACCOUNT)]),
          parameters,
        ),
      );

      expect(rejection).toBeInstanceOf(SymmError);
      expect(rejection).toMatchObject({ kind: "validation", code: "WITHDRAW_REQUEST_NOT_FINALIZED" });
      const { message } = rejection as SymmError;
      expect(message).toContain("#10");
      expect(message).toContain("#9");
      expect(message).toContain(TEST_ACCOUNT);
    });

    it("throws WITHDRAW_REQUEST_NOT_FINALIZED when the transaction finalized nothing", () => {
      const rejection = rejectionOf(() =>
        getWithdrawRequestIdFromReceipt(receipt([withdrawalLog(10n, TEST_ACCOUNT)]), parameters),
      );

      expect(rejection).toBeInstanceOf(SymmError);
      expect(rejection).toMatchObject({ code: "WITHDRAW_REQUEST_NOT_FINALIZED" });
      expect((rejection as SymmError).message).toContain("#10");
    });

    it.each([
      ["another user", finalizedLog(10n, OTHER_USER)],
      ["another contract", finalizedLog(10n, TEST_ACCOUNT, OTHER_CONTRACT)],
    ])("ignores a matching-id WithdrawFinalized from %s", (_, foreignFinalize) => {
      const rejection = rejectionOf(() =>
        getWithdrawRequestIdFromReceipt(receipt([withdrawalLog(10n, TEST_ACCOUNT), foreignFinalize]), parameters),
      );

      expect(rejection).toBeInstanceOf(SymmError);
      expect(rejection).toMatchObject({ code: "WITHDRAW_REQUEST_NOT_FINALIZED" });
    });

    it.each([
      ["omitted", { user: TEST_ACCOUNT, symmioAddress: SYMMIO }],
      ["false", { user: TEST_ACCOUNT, symmioAddress: SYMMIO, requireFinalized: false }],
    ])("ignores finalize events when the flag is %s", (_, withoutFlag) => {
      expect(
        getWithdrawRequestIdFromReceipt(
          receipt([withdrawalLog(10n, TEST_ACCOUNT), finalizedLog(9n, TEST_ACCOUNT)]),
          withoutFlag,
        ),
      ).toBe(10n);
    });
  });
});
