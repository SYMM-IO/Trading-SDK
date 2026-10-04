import { beforeEach, describe, expect, it, vi } from "vitest";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, TEST_GASLESS_SIGNER, gaslessWriteTestConfig } from "../test/config";
import { GaslessRequestStatus, type GaslessSubmitReceipt } from "../types";
import type { GaslessUnconfirmedSubmit } from "../unconfirmed-submit";

const resubmitGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("./resubmit-gasless-request", () => ({ resubmitGaslessRequest }));

import { resubmitGaslessRequestMutationOptions } from "./query";

const RECEIPT: GaslessSubmitReceipt = {
  requestId: "req-r1",
  status: GaslessRequestStatus.QUEUED,
  paidFee: null,
  remainingFeeAllowance: null,
  idempotencyKey: "key-1",
  protocolInstance: TEST_GASLESS.protocolInstance ?? null,
  owner: TEST_GASLESS_SIGNER,
  walletIds: [0n],
};

const VARIABLES: GaslessUnconfirmedSubmit = {
  chainId: GASLESS_TEST_CHAIN,
  service: "operations",
  path: "/gateway/relay-instant",
  body: { idempotencyKey: "key-1", userAddress: TEST_GASLESS_SIGNER },
  idempotencyKey: "key-1",
};

describe("resubmitGaslessRequestMutationOptions", () => {
  beforeEach(() => {
    resubmitGaslessRequest.mockReset();
  });

  it("tags the mutation with a stable key and carries no query key", () => {
    const { config } = gaslessWriteTestConfig();

    const options = resubmitGaslessRequestMutationOptions(config);

    expect(options.mutationKey).toEqual(["resubmitGaslessRequest"]);
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config and forwards the recorded submit untouched", async () => {
    const { config } = gaslessWriteTestConfig();
    resubmitGaslessRequest.mockResolvedValue(RECEIPT);

    await expect(resubmitGaslessRequestMutationOptions(config).mutationFn(VARIABLES)).resolves.toBe(RECEIPT);
    expect(resubmitGaslessRequest).toHaveBeenCalledWith(config, VARIABLES);
  });
});
