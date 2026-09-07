import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessOperationalFeeQuote } from "./get-gasless-operational-fee-quote";

const ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const OPERATION: SignedOperation = {
  signer: "0x1111111111111111111111111111111111111111",
  target: "0x2222222222222222222222222222222222222222",
  callData: "0xcf70cb69",
  signerAccount: { addr: ACCOUNT, isPartyB: false },
  flexFields: [],
  maxUses: 1n,
  replayAttackHeader: { nonce: 7n, deadline: 4_102_444_800n, salt: `0x${"11".repeat(32)}` },
};

describe("getGaslessOperationalFeeQuote", () => {
  it("quotes the exact operations against the GaslessLayer", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValueOnce([1_000_000n, 1n, false]);

    const quote = await getGaslessOperationalFeeQuote(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: ACCOUNT,
      operations: [OPERATION],
    });

    expect(quote).toEqual({ amountDue: 1_000_000n, freeOpsApplied: 1n, wouldBlockOnQuota: false });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GASLESS.gaslessLayerAddress,
        functionName: "getAccountOperationalFee",
      }),
    );
  });
});
