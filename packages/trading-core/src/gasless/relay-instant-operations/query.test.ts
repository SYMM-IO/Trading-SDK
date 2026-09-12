import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { GASLESS_TEST_CHAIN, TEST_GASLESS_SIGNATURE, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus, type GaslessSubmitReceipt } from "../types";
import type { RelayInstantOperationsParameters } from "./relay-instant-operations";

const relayInstantOperations = vi.hoisted(() => vi.fn());

vi.mock("./relay-instant-operations", () => ({ relayInstantOperations }));

import { relayInstantOperationsMutationOptions } from "./query";

const OPERATION: SignedOperation = {
  signer: "0x1111111111111111111111111111111111111111",
  target: "0x2222222222222222222222222222222222222222",
  callData: "0xcf70cb69",
  signerAccount: { addr: "0x3333333333333333333333333333333333333333", isPartyB: false },
  flexFields: [],
  maxUses: 1n,
  replayAttackHeader: { nonce: 7n, deadline: 4_102_444_800n, salt: `0x${"11".repeat(32)}` },
};

const RECEIPT: GaslessSubmitReceipt = {
  requestId: "req-1",
  status: GaslessRequestStatus.QUEUED,
  paidFee: 1_000_000n,
  remainingFeeAllowance: 5_000_000n,
};

/** Every optional field set, so a variable the factory dropped would fail the equality below. */
const VARIABLES: RelayInstantOperationsParameters = {
  chainId: GASLESS_TEST_CHAIN,
  operations: [{ operation: OPERATION, signature: TEST_GASLESS_SIGNATURE, fills: [], flexFillerSignatures: [] }],
  operationType: "addMargin",
  userAddress: OPERATION.signer,
  accountId: "acct-1",
  templateId: 3,
  idempotencyKey: "idem-1",
  metadata: { flow: "margin" },
};

describe("relayInstantOperationsMutationOptions", () => {
  beforeEach(() => {
    relayInstantOperations.mockReset();
  });

  it("tags the mutation with a stable key and carries no query key", () => {
    const { config } = gaslessTestConfig();

    const options = relayInstantOperationsMutationOptions(config);

    expect(options.mutationKey).toEqual(["relayInstantOperations"]);
    expect(options).not.toHaveProperty("queryKey");
  });

  it("binds the config and forwards every variable to the action", async () => {
    const { config } = gaslessTestConfig();
    relayInstantOperations.mockResolvedValue(RECEIPT);

    await expect(relayInstantOperationsMutationOptions(config).mutationFn(VARIABLES)).resolves.toBe(RECEIPT);
    expect(relayInstantOperations).toHaveBeenCalledWith(config, VARIABLES);
  });
});
