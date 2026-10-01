import { decodeFunctionData, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { rawFeeQuote } from "../test/fee-quote";
import { getGaslessFeeQuoteQueryKey, getGaslessFeeQuoteQueryOptions } from "./query";

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

describe("getGaslessFeeQuoteQueryKey", () => {
  it("stringifies the operations' bigints so the key stays hashable", () => {
    const key = getGaslessFeeQuoteQueryKey({ operations: [{ operation: OPERATION, walletId: 2n }], configKey: "k" });

    expect(key[0]).toBe("getGaslessFeeQuote");
    expect(key[1]).toMatchObject({
      configKey: "k",
      operations: [
        { operation: { maxUses: "1", replayAttackHeader: { nonce: "7", deadline: "4102444800" } }, walletId: "2" },
      ],
    });
    expect(() => JSON.stringify(key)).not.toThrow();
  });

  it("keys an omitted wallet id as wallet 0", () => {
    expect(getGaslessFeeQuoteQueryKey({ operations: [{ operation: OPERATION }] })).toEqual(
      getGaslessFeeQuoteQueryKey({ operations: [{ operation: OPERATION, walletId: 0n }] }),
    );
    expect(getGaslessFeeQuoteQueryKey({ operations: [{ operation: OPERATION }] })).not.toEqual(
      getGaslessFeeQuoteQueryKey({ operations: [{ operation: OPERATION, walletId: 1n }] }),
    );
  });

  it("accepts no options at all", () => {
    expect(getGaslessFeeQuoteQueryKey()).toEqual(["getGaslessFeeQuote", {}]);
  });
});

describe("getGaslessFeeQuoteQueryOptions", () => {
  it("keys the query by chain, operations, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessFeeQuoteQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      operations: [{ operation: OPERATION }],
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual(
      getGaslessFeeQuoteQueryKey({
        chainId: GASLESS_TEST_CHAIN,
        operations: [{ operation: OPERATION }],
        configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN),
      }),
    );
  });

  it("re-keys when an operation changes, so a stale quote is never reused", () => {
    const { config } = gaslessTestConfig();
    const next = { ...OPERATION, replayAttackHeader: { ...OPERATION.replayAttackHeader, nonce: 8n } };

    const first = getGaslessFeeQuoteQueryOptions(config, { operations: [{ operation: OPERATION }] });
    const second = getGaslessFeeQuoteQueryOptions(config, { operations: [{ operation: next }] });

    expect(second.queryKey).not.toEqual(first.queryKey);
  });

  it("honours query.enabled", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessFeeQuoteQueryOptions(config, {
      operations: [{ operation: OPERATION }],
      query: { enabled: false },
    });

    expect(options.enabled).toBe(false);
  });

  it("queryFn quotes the forwarded operations and wallet ids on the forwarded chain", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(rawFeeQuote(ACCOUNT));
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessFeeQuoteQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      operations: [{ operation: OPERATION }, { operation: OPERATION, walletId: 3n }],
    });

    await expect(options.queryFn()).resolves.toMatchObject({ exact: false, totalFee18: 50_000_000_000_000_000n });
    const [read] = readContract.mock.calls[0] as [{ functionName: string; args: readonly [Hex, bigint] }];
    expect(read.functionName).toBe("previewFeeQuote");
    const { args } = decodeFunctionData({ abi: gaslessLayerAbi, data: read.args[0] });
    expect(args[0]).toEqual([OPERATION, OPERATION]);
    expect(args[4]).toEqual([0n, 3n]);
  });
});
