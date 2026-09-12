import { beforeEach, describe, expect, it, vi } from "vitest";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus, type GaslessDepositSubmitReceipt } from "../types";
import type { SettleGaslessDepositExistingAccountParameters } from "./settle-gasless-deposit-existing-account";

const settleGaslessDepositExistingAccount = vi.hoisted(() => vi.fn());

vi.mock("./settle-gasless-deposit-existing-account", () => ({ settleGaslessDepositExistingAccount }));

import { settleGaslessDepositExistingAccountMutationOptions } from "./query";

const RECEIPT: GaslessDepositSubmitReceipt = {
  requestId: "dep-2",
  status: GaslessRequestStatus.QUEUED,
  depositAddress: "0x5555555555555555555555555555555555555555",
  observedAmount: 5_000_000n,
  paidFee: 1_000_000n,
  creditedAmount: 4_000_000n,
};

/** Every optional field set, so a variable the factory dropped would fail the equality below. */
const VARIABLES: SettleGaslessDepositExistingAccountParameters = {
  chainId: GASLESS_TEST_CHAIN,
  wallet: "0x1111111111111111111111111111111111111111",
  subAccount: "0x3333333333333333333333333333333333333333",
  idempotencyKey: "dep-key-2",
};

describe("settleGaslessDepositExistingAccountMutationOptions", () => {
  beforeEach(() => {
    settleGaslessDepositExistingAccount.mockReset();
  });

  it("tags the mutation with a stable key and carries no query key", () => {
    const { config } = gaslessTestConfig();

    const options = settleGaslessDepositExistingAccountMutationOptions(config);

    expect(options.mutationKey).toEqual(["settleGaslessDepositExistingAccount"]);
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config and forwards every variable to the action", async () => {
    const { config } = gaslessTestConfig();
    settleGaslessDepositExistingAccount.mockResolvedValue(RECEIPT);

    await expect(settleGaslessDepositExistingAccountMutationOptions(config).mutationFn(VARIABLES)).resolves.toBe(
      RECEIPT,
    );
    expect(settleGaslessDepositExistingAccount).toHaveBeenCalledWith(config, VARIABLES);
  });
});
