import { beforeEach, describe, expect, it, vi } from "vitest";
import { GASLESS_TEST_CHAIN, TEST_GASLESS_SIGNER, gaslessWriteTestConfig } from "../test/config";
import { GaslessRequestStatus, type GaslessSubmitReceipt } from "../types";
import type { RelayGrantDelegationParameters } from "./relay-grant-delegation";

const relayGrantDelegation = vi.hoisted(() => vi.fn());

vi.mock("./relay-grant-delegation", () => ({ relayGrantDelegation }));

import { relayGrantDelegationMutationOptions } from "./query";

const RECEIPT: GaslessSubmitReceipt = {
  requestId: "req-d1",
  status: GaslessRequestStatus.QUEUED,
  paidFee: 0n,
  remainingFeeAllowance: 0n,
};

/** Every optional field set, so a variable the factory dropped would fail the equality below. */
const VARIABLES: RelayGrantDelegationParameters = {
  chainId: GASLESS_TEST_CHAIN,
  from: TEST_GASLESS_SIGNER,
  account: "0x3333333333333333333333333333333333333333",
  delegatedSigner: "0x6666666666666666666666666666666666666666",
  selectors: ["0xcf70cb69"],
  expiryTimestamp: 4_102_444_800n,
  idempotencyKey: "idem-1",
};

describe("relayGrantDelegationMutationOptions", () => {
  beforeEach(() => {
    relayGrantDelegation.mockReset();
  });

  it("tags the mutation with a stable key and carries no query key", () => {
    const { config } = gaslessWriteTestConfig();

    const options = relayGrantDelegationMutationOptions(config);

    expect(options.mutationKey).toEqual(["relayGrantDelegation"]);
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config and forwards every variable to the action", async () => {
    const { config } = gaslessWriteTestConfig();
    relayGrantDelegation.mockResolvedValue(RECEIPT);

    await expect(relayGrantDelegationMutationOptions(config).mutationFn(VARIABLES)).resolves.toBe(RECEIPT);
    expect(relayGrantDelegation).toHaveBeenCalledWith(config, VARIABLES);
  });
});
