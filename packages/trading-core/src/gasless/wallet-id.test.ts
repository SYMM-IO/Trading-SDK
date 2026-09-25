import { maxUint256 } from "viem";
import { describe, expect, it } from "vitest";
import { assertGaslessWalletId, parseGaslessWalletId, toGaslessWalletIdWire } from "./wallet-id";

describe("assertGaslessWalletId", () => {
  it.each([0n, 1n, 2n, maxUint256])("accepts %s", (walletId) => {
    expect(assertGaslessWalletId(walletId)).toBe(walletId);
  });

  it.each([
    { label: "a negative id", value: -1n },
    { label: "an overflowing id", value: maxUint256 + 1n },
    { label: "a number", value: 1 },
    { label: "a decimal string", value: "1" },
  ])("rejects $label", ({ value }) => {
    expect(() => assertGaslessWalletId(value as bigint)).toThrowError(
      expect.objectContaining({ code: "GASLESS_WALLET_ID_INVALID", kind: "validation" }),
    );
  });

  it("names the offending field in the message", () => {
    expect(() => assertGaslessWalletId(-1n, "operations[2].walletId")).toThrowError(/operations\[2\]\.walletId -1n/);
  });
});

describe("toGaslessWalletIdWire", () => {
  it("encodes ids as decimal strings, including the uint256 maximum", () => {
    expect(toGaslessWalletIdWire(0n)).toBe("0");
    expect(toGaslessWalletIdWire(2n)).toBe("2");
    expect(toGaslessWalletIdWire(maxUint256)).toBe(maxUint256.toString());
  });

  it("refuses an id outside the uint256 range", () => {
    expect(() => toGaslessWalletIdWire(-1n)).toThrowError(
      expect.objectContaining({ code: "GASLESS_WALLET_ID_INVALID" }),
    );
  });
});

describe("parseGaslessWalletId", () => {
  it("parses decimal strings and bigints in range", () => {
    expect(parseGaslessWalletId("0")).toBe(0n);
    expect(parseGaslessWalletId("2")).toBe(2n);
    expect(parseGaslessWalletId(maxUint256.toString())).toBe(maxUint256);
    expect(parseGaslessWalletId(3n)).toBe(3n);
  });

  it.each([
    { label: "a negative string", value: "-1" },
    { label: "a fractional string", value: "1.5" },
    { label: "a hex string", value: "0x1" },
    { label: "an exponent", value: "1e3" },
    { label: "whitespace", value: " 1" },
    { label: "an empty string", value: "" },
    { label: "an overflowing string", value: (maxUint256 + 1n).toString() },
    { label: "a number", value: 1 },
    { label: "a boolean", value: true },
    { label: "null", value: null },
  ])("rejects $label", ({ value }) => {
    expect(() => parseGaslessWalletId(value)).toThrowError(
      expect.objectContaining({ code: "GASLESS_WALLET_ID_INVALID" }),
    );
  });
});
