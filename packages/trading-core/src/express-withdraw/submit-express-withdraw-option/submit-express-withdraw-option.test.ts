import { describe, expect, it, vi } from "vitest";

const initiateWithdraw = vi.hoisted(() => vi.fn());

vi.mock("../../symmio-contracts/symmio", () => ({ initiateWithdraw }));

import { TEST_TX_HASH } from "../../shared/test/mock-config";
import { createExpressConfig, createExpressOption, TEST_ACCOUNT, TEST_AMOUNT, TEST_RECEIVER } from "../test-fixtures";
import { submitExpressWithdrawOption } from "./submit-express-withdraw-option";

describe("submitExpressWithdrawOption", () => {
  it("validates then submits the signed parts and always disables speed-up", async () => {
    initiateWithdraw.mockResolvedValue(TEST_TX_HASH);
    const config = createExpressConfig();
    const option = createExpressOption();

    await expect(
      submitExpressWithdrawOption(config, {
        account: TEST_ACCOUNT,
        amount: TEST_AMOUNT,
        receiver: TEST_RECEIVER,
        option,
        simulateBeforeWrite: false,
      }),
    ).resolves.toBe(TEST_TX_HASH);

    expect(initiateWithdraw).toHaveBeenCalledWith(config, {
      account: TEST_ACCOUNT,
      parts: option.parts,
      speedUp: false,
      providerData: option.providerData,
      chainId: config.defaultChainId,
      from: undefined,
      simulateBeforeWrite: false,
      gasless: undefined,
    });
  });
});
