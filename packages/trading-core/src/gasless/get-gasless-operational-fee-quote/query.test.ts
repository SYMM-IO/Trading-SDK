import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { getGaslessOperationalFeeQuoteQueryKey, getGaslessOperationalFeeQuoteQueryOptions } from "./query";

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

describe("getGaslessOperationalFeeQuoteQueryKey", () => {
  it("stringifies the operations' bigints so the key stays hashable", () => {
    const key = getGaslessOperationalFeeQuoteQueryKey({ account: ACCOUNT, operations: [OPERATION], configKey: "k" });

    expect(key[0]).toBe("getGaslessOperationalFeeQuote");
    expect(key[1]).toMatchObject({
      account: ACCOUNT,
      configKey: "k",
      operations: [{ maxUses: "1", replayAttackHeader: { nonce: "7", deadline: "4102444800" } }],
    });
    expect(() => JSON.stringify(key)).not.toThrow();
  });

  it("accepts no options at all", () => {
    expect(getGaslessOperationalFeeQuoteQueryKey()).toEqual(["getGaslessOperationalFeeQuote", {}]);
  });
});

describe("getGaslessOperationalFeeQuoteQueryOptions", () => {
  it("keys the query by chain, account, operations, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessOperationalFeeQuoteQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: ACCOUNT,
      operations: [OPERATION],
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual(
      getGaslessOperationalFeeQuoteQueryKey({
        chainId: GASLESS_TEST_CHAIN,
        account: ACCOUNT,
        operations: [OPERATION],
        configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN),
      }),
    );
  });

  it("re-keys when the operations change, so a stale quote is never reused", () => {
    const { config } = gaslessTestConfig();
    const next = { ...OPERATION, replayAttackHeader: { ...OPERATION.replayAttackHeader, nonce: 8n } };

    const first = getGaslessOperationalFeeQuoteQueryOptions(config, { account: ACCOUNT, operations: [OPERATION] });
    const second = getGaslessOperationalFeeQuoteQueryOptions(config, { account: ACCOUNT, operations: [next] });

    expect(second.queryKey).not.toEqual(first.queryKey);
  });

  it("honours query.enabled", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessOperationalFeeQuoteQueryOptions(config, {
      account: ACCOUNT,
      operations: [OPERATION],
      query: { enabled: false },
    });

    expect(options.enabled).toBe(false);
  });

  it("queryFn quotes the forwarded operations for the forwarded account on the forwarded chain", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue([1_000_000n, 0n, false]);
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessOperationalFeeQuoteQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: ACCOUNT,
      operations: [OPERATION],
    });

    await expect(options.queryFn()).resolves.toEqual({
      amountDue: 1_000_000n,
      freeOpsApplied: 0n,
      wouldBlockOnQuota: false,
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getAccountOperationalFee",
        args: [
          ACCOUNT,
          [
            expect.objectContaining({
              callData: OPERATION.callData,
              replayAttackHeader: OPERATION.replayAttackHeader,
            }),
          ],
        ],
      }),
    );
  });
});
