import { describe, expect, it } from "vitest";
import { SymmError } from "../shared/errors/symm-error";
import type { SignedOperation } from "../solvers/instant-open/shared/types";
import { formatGaslessOperation, toGaslessSafeNumber } from "./format-gasless-operation";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const OPERATION: SignedOperation = {
  signer: "0x1111111111111111111111111111111111111111",
  target: "0x2222222222222222222222222222222222222222",
  callData: "0xcf70cb69",
  signerAccount: { addr: "0x3333333333333333333333333333333333333333", isPartyB: false },
  flexFields: [
    { offset: 36n, length: 32n, authorizedFlexFiller: "0x4444444444444444444444444444444444444444" },
    { offset: 68n, length: 20n, authorizedFlexFiller: "0x5555555555555555555555555555555555555555" },
  ],
  maxUses: 1n,
  replayAttackHeader: { nonce: 7n, deadline: 4_102_444_800n, salt: `0x${"11".repeat(32)}` },
};

describe("toGaslessSafeNumber", () => {
  it.each([
    { value: 0n, expected: 0 },
    { value: 4_102_444_800n, expected: 4_102_444_800 },
    { value: MAX_SAFE, expected: Number.MAX_SAFE_INTEGER },
  ])("converts $value to a JSON number", ({ value, expected }) => {
    expect(toGaslessSafeNumber(value, "nonce")).toBe(expected);
  });

  it.each([
    { label: "one past the safe-integer range", value: MAX_SAFE + 1n },
    { label: "negative", value: -1n },
  ])("refuses a $label value instead of silently rounding it", ({ value }) => {
    expect(() => toGaslessSafeNumber(value, "replayAttackHeader.nonce")).toThrow(SymmError);
    expect(() => toGaslessSafeNumber(value, "replayAttackHeader.nonce")).toThrow(
      expect.objectContaining({ code: "GASLESS_VALUE_UNSAFE" }),
    );
    expect(() => toGaslessSafeNumber(value, "replayAttackHeader.nonce")).toThrow(/replayAttackHeader\.nonce/);
  });
});

describe("formatGaslessOperation", () => {
  it("serializes every uint256 field as a JSON number and keeps the rest verbatim", () => {
    expect(formatGaslessOperation(OPERATION)).toEqual({
      signer: OPERATION.signer,
      target: OPERATION.target,
      callData: OPERATION.callData,
      signerAccount: { addr: OPERATION.signerAccount.addr, isPartyB: false },
      flexFields: [
        { offset: 36, length: 32, authorizedFlexFiller: "0x4444444444444444444444444444444444444444" },
        { offset: 68, length: 20, authorizedFlexFiller: "0x5555555555555555555555555555555555555555" },
      ],
      maxUses: 1,
      replayAttackHeader: { nonce: 7, deadline: 4_102_444_800, salt: OPERATION.replayAttackHeader.salt },
    });
  });

  it("keeps an operation without flex fields as an empty list", () => {
    expect(formatGaslessOperation({ ...OPERATION, flexFields: [] }).flexFields).toEqual([]);
  });

  it.each([
    {
      field: "replayAttackHeader.nonce",
      operation: { ...OPERATION, replayAttackHeader: { ...OPERATION.replayAttackHeader, nonce: MAX_SAFE + 1n } },
    },
    {
      field: "replayAttackHeader.deadline",
      operation: { ...OPERATION, replayAttackHeader: { ...OPERATION.replayAttackHeader, deadline: -1n } },
    },
    { field: "maxUses", operation: { ...OPERATION, maxUses: MAX_SAFE + 1n } },
    {
      field: "flexFields.offset",
      operation: { ...OPERATION, flexFields: [{ ...OPERATION.flexFields[0]!, offset: MAX_SAFE + 1n }] },
    },
    {
      field: "flexFields.length",
      operation: { ...OPERATION, flexFields: [{ ...OPERATION.flexFields[0]!, length: -1n }] },
    },
  ])("names $field when that field is outside the safe range", ({ field, operation }) => {
    expect(() => formatGaslessOperation(operation)).toThrow(expect.objectContaining({ code: "GASLESS_VALUE_UNSAFE" }));
    expect(() => formatGaslessOperation(operation)).toThrow(field);
  });
});
