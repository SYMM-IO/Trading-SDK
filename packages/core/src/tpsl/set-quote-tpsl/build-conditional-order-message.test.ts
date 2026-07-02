import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { TpSlConditionalOrderLeg } from "../types";
import {
  buildConditionalOrderMessage,
  buildTpSlDeleteMessage,
  generateTpSlSalt,
  toSignableTpSlMessage,
  ZERO_LEG,
} from "./build-conditional-order-message";

const VA: Address = "0x1111111111111111111111111111111111111111";
const SA: Address = "0x2222222222222222222222222222222222222222";
const AFFILIATE: Address = "0x3333333333333333333333333333333333333333";

const LEG: TpSlConditionalOrderLeg = {
  quantity: "10",
  price: "1.0",
  orderType: 1,
  conditionalPrice: "1.1",
  conditionalPriceType: "market",
};

describe("generateTpSlSalt", () => {
  it("returns a decimal string that fits in uint256", () => {
    const salt = generateTpSlSalt();
    expect(salt).toMatch(/^\d+$/);
    // 2^256 - 1
    const MAX = (1n << 256n) - 1n;
    expect(BigInt(salt) <= MAX).toBe(true);
  });

  it("is (practically) unique across calls", () => {
    const a = generateTpSlSalt();
    const b = generateTpSlSalt();
    expect(a).not.toBe(b);
  });
});

describe("buildConditionalOrderMessage", () => {
  it("assembles a full message with the injected salt", () => {
    const message = buildConditionalOrderMessage({
      virtualAccount: VA,
      subAccount: SA,
      quoteId: 42,
      symbolId: 1,
      positionType: 0,
      affiliate: AFFILIATE,
      takeProfit: LEG,
      stopLoss: null,
      salt: "123",
    });
    expect(message).toEqual({
      virtualAccount: VA,
      subAccount: SA,
      salt: "123",
      quoteId: 42,
      symbolId: 1,
      positionType: 0,
      affiliate: AFFILIATE,
      takeProfit: LEG,
      stopLoss: null,
      sendQuote: null,
    });
  });

  it("auto-generates a salt when none is provided", () => {
    const message = buildConditionalOrderMessage({
      virtualAccount: VA,
      subAccount: SA,
      quoteId: null,
      symbolId: 1,
      positionType: 1,
      affiliate: AFFILIATE,
      takeProfit: null,
      stopLoss: LEG,
    });
    expect(message.salt).toMatch(/^\d+$/);
  });
});

describe("buildTpSlDeleteMessage", () => {
  it("produces the shape the DELETE endpoint expects", () => {
    expect(
      buildTpSlDeleteMessage({
        virtualAccount: VA,
        cohQuoteId: "coh42",
        conditionalOrderType: "take_profit",
        salt: "9",
      }),
    ).toEqual({
      virtualAccount: VA,
      salt: "9",
      cohQuoteId: "coh42",
      conditionalOrderType: "take_profit",
    });
  });
});

describe("toSignableTpSlMessage", () => {
  it("replaces null legs with ZERO_LEG and null quoteId with 0", () => {
    const padded = toSignableTpSlMessage({
      quoteId: null,
      takeProfit: null,
      stopLoss: LEG,
      sendQuote: null,
    });
    expect(padded.quoteId).toBe(0);
    expect(padded.takeProfit).toEqual(ZERO_LEG);
    expect(padded.stopLoss).toEqual(LEG);
    // sendQuote gets an extra `leverage: 0` field on the padded shape.
    expect(padded.sendQuote).toEqual({ ...ZERO_LEG, leverage: 0 });
  });

  it("does not add fields that were absent from the input", () => {
    const padded = toSignableTpSlMessage({ foo: "bar" });
    expect(padded).toEqual({ foo: "bar" });
  });

  it("leaves non-null values untouched", () => {
    const padded = toSignableTpSlMessage({
      quoteId: 7,
      takeProfit: LEG,
      stopLoss: LEG,
      sendQuote: LEG,
    });
    expect(padded.quoteId).toBe(7);
    expect(padded.takeProfit).toBe(LEG);
    expect(padded.stopLoss).toBe(LEG);
    expect(padded.sendQuote).toBe(LEG);
  });
});
