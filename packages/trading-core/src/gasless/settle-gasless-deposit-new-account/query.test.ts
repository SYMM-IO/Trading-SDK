import { zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus, type GaslessDepositSubmitReceipt } from "../types";
import type { SettleGaslessDepositNewAccountParameters } from "./settle-gasless-deposit-new-account";

const settleGaslessDepositNewAccount = vi.hoisted(() => vi.fn());

vi.mock("./settle-gasless-deposit-new-account", () => ({ settleGaslessDepositNewAccount }));

import { settleGaslessDepositNewAccountMutationOptions } from "./query";

const RECEIPT: GaslessDepositSubmitReceipt = {
  requestId: "dep-1",
  status: GaslessRequestStatus.QUEUED,
  depositAddress: "0x5555555555555555555555555555555555555555",
  observedAmount: 5_000_000n,
  paidFee: 1_000_000n,
  creditedAmount: 4_000_000n,
};

/** Every optional field set, so a variable the factory dropped would fail the equality below. */
const VARIABLES: SettleGaslessDepositNewAccountParameters = {
  chainId: GASLESS_TEST_CHAIN,
  wallet: "0x1111111111111111111111111111111111111111",
  affiliate: zeroAddress,
  accountData: {
    name: "Main",
    isolationType: SubAccountIsolationType.MARKET_DIRECTION,
    singleVAMode: true,
    metadata: "0x1234",
  },
  idempotencyKey: "dep-key-1",
  metadata: { flow: "onboarding" },
};

describe("settleGaslessDepositNewAccountMutationOptions", () => {
  beforeEach(() => {
    settleGaslessDepositNewAccount.mockReset();
  });

  it("tags the mutation with a stable key and carries no query key", () => {
    const { config } = gaslessTestConfig();

    const options = settleGaslessDepositNewAccountMutationOptions(config);

    expect(options.mutationKey).toEqual(["settleGaslessDepositNewAccount"]);
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config and forwards every variable to the action", async () => {
    const { config } = gaslessTestConfig();
    settleGaslessDepositNewAccount.mockResolvedValue(RECEIPT);

    await expect(settleGaslessDepositNewAccountMutationOptions(config).mutationFn(VARIABLES)).resolves.toBe(RECEIPT);
    expect(settleGaslessDepositNewAccount).toHaveBeenCalledWith(config, VARIABLES);
  });
});
