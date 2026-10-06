import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { SymmError } from "../shared/errors/symm-error";
import { createExpressOption, TEST_AMOUNT, TEST_PROVIDER, TEST_RECEIVER } from "./test-fixtures";
import { validateExpressWithdrawOption } from "./validate-express-withdraw-option";

function validate(option = createExpressOption()) {
  return validateExpressWithdrawOption({
    option,
    amount: TEST_AMOUNT,
    receiver: TEST_RECEIVER,
    providerAddress: TEST_PROVIDER,
    chainId: SymmioSupportedChainId.ARBITRUM,
  });
}

describe("validateExpressWithdrawOption", () => {
  it("accepts an option bound to the exact same-chain intent", () => {
    expect(() => validate()).not.toThrow();
  });

  it.each([
    ["EXPRESS_WITHDRAW_OPTION_TYPE_MISMATCH", () => createExpressOption({ optionType: 2 })],
    ["EXPRESS_WITHDRAW_OPTION_EXPIRED", () => createExpressOption({ deadline: Math.floor(Date.now() / 1000) - 1 })],
    [
      "EXPRESS_WITHDRAW_PROVIDER_MISMATCH",
      () =>
        createExpressOption({
          parts: [{ ...createExpressOption().parts[0]!, expressProvider: zeroAddress }],
        }),
    ],
    [
      "EXPRESS_WITHDRAW_RECEIVER_MISMATCH",
      () =>
        createExpressOption({
          parts: [{ ...createExpressOption().parts[0]!, receiver: TEST_PROVIDER }],
        }),
    ],
    [
      "EXPRESS_WITHDRAW_CROSS_CHAIN_UNSUPPORTED",
      () =>
        createExpressOption({
          parts: [{ ...createExpressOption().parts[0]!, chainId: 8453n }],
        }),
    ],
    [
      "EXPRESS_WITHDRAW_AMOUNT_MISMATCH",
      () =>
        createExpressOption({
          parts: [{ ...createExpressOption().parts[0]!, amount: TEST_AMOUNT - 1n }],
        }),
    ],
    ["EXPRESS_WITHDRAW_PARTS_HASH_MISMATCH", () => createExpressOption({ partsHash: `0x${"00".repeat(32)}` })],
    ["EXPRESS_WITHDRAW_PROVIDER_DATA_MALFORMED", () => createExpressOption({ providerData: "0x1234" })],
  ])("rejects %s", (code, buildOption) => {
    const rejection = (() => {
      try {
        validate(buildOption());
      } catch (error) {
        return error;
      }
    })();

    expect(rejection).toBeInstanceOf(SymmError);
    expect((rejection as SymmError).code).toBe(code);
  });

  it("rejects exposed offer fields that disagree with the nested provider payload", () => {
    const signed = createExpressOption();
    const rejection = (() => {
      try {
        validate({ ...signed, fee: signed.fee + 1n });
      } catch (error) {
        return error;
      }
    })();

    expect(rejection).toBeInstanceOf(SymmError);
    expect((rejection as SymmError).code).toBe("EXPRESS_WITHDRAW_PROVIDER_DATA_MISMATCH");
  });
});
