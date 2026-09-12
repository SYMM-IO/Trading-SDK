import { beforeEach, describe, expect, it, vi } from "vitest";
import { GASLESS_TEST_CHAIN, TEST_GASLESS_SIGNER, gaslessWriteTestConfig } from "../test/config";
import { GaslessRequestStatus, type GaslessSubmitReceipt } from "../types";
import type { GaslessWalletExecuteParameters } from "./gasless-wallet-execute";

const gaslessWalletExecute = vi.hoisted(() => vi.fn());

vi.mock("./gasless-wallet-execute", () => ({ gaslessWalletExecute }));

import { gaslessWalletExecuteMutationOptions } from "./query";

const RECEIPT: GaslessSubmitReceipt = {
  requestId: "req-w1",
  status: GaslessRequestStatus.QUEUED,
  paidFee: 0n,
  remainingFeeAllowance: 0n,
};

/** Every optional field set, so a variable the factory dropped would fail the equality below. */
const VARIABLES: GaslessWalletExecuteParameters = {
  chainId: GASLESS_TEST_CHAIN,
  from: TEST_GASLESS_SIGNER,
  owner: TEST_GASLESS_SIGNER,
  signerAccount: "0x3333333333333333333333333333333333333333",
  calls: [{ target: "0x9999999999999999999999999999999999999999", value: 0n, data: "0xa9059cbb" }],
  operationType: "bridgeWithdraw",
  idempotencyKey: "idem-1",
  metadata: { flow: "exit" },
};

describe("gaslessWalletExecuteMutationOptions", () => {
  beforeEach(() => {
    gaslessWalletExecute.mockReset();
  });

  it("tags the mutation with a stable key and carries no query key", () => {
    const { config } = gaslessWriteTestConfig();

    const options = gaslessWalletExecuteMutationOptions(config);

    expect(options.mutationKey).toEqual(["gaslessWalletExecute"]);
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config and forwards every variable to the action", async () => {
    const { config } = gaslessWriteTestConfig();
    gaslessWalletExecute.mockResolvedValue(RECEIPT);

    await expect(gaslessWalletExecuteMutationOptions(config).mutationFn(VARIABLES)).resolves.toBe(RECEIPT);
    expect(gaslessWalletExecute).toHaveBeenCalledWith(config, VARIABLES);
  });
});
