import { encodeFunctionData, erc20Abi, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { rawFeeQuote } from "../test/fee-quote";
import { getGaslessBatchFeeQuoteQueryKey, getGaslessBatchFeeQuoteQueryOptions } from "./query";

const ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const RECIPIENT: Address = "0x7777777777777777777777777777777777777777";

describe("getGaslessBatchFeeQuoteQueryKey", () => {
  it("keys a call by its encoded calldata, so every way of writing it shares one entry", () => {
    const data = encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [5n] });
    const byName = getGaslessBatchFeeQuoteQueryKey({
      account: ACCOUNT,
      calls: [{ functionName: "allocate", args: [5n] }],
    });

    expect(
      getGaslessBatchFeeQuoteQueryKey({
        account: ACCOUNT,
        calls: [{ abi: symmioAbi, functionName: "allocate", args: [5n] }],
      }),
    ).toEqual(byName);
    expect(getGaslessBatchFeeQuoteQueryKey({ account: ACCOUNT, calls: [{ data }] })).toEqual(byName);
    /** A full contract ABI never reaches the key. */
    expect(JSON.stringify(byName)).not.toContain("stateMutability");
  });

  it("makes a wallet entry's defaults explicit and changes with any argument", () => {
    const transfer = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] });
    const implicit = getGaslessBatchFeeQuoteQueryKey({
      account: ACCOUNT,
      calls: [{ walletCalls: [{ target: USDC, data: transfer }] }],
    });

    expect(
      getGaslessBatchFeeQuoteQueryKey({
        account: ACCOUNT,
        calls: [{ walletId: 0n, walletCalls: [{ target: USDC, value: 0n, data: transfer }] }],
      }),
    ).toEqual(implicit);
    expect(
      getGaslessBatchFeeQuoteQueryKey({
        account: ACCOUNT,
        calls: [{ walletId: 2n, walletCalls: [{ target: USDC, data: transfer }] }],
      }),
    ).not.toEqual(implicit);
    expect(
      getGaslessBatchFeeQuoteQueryKey({ account: ACCOUNT, calls: [{ functionName: "allocate", args: [6n] }] }),
    ).not.toEqual(
      getGaslessBatchFeeQuoteQueryKey({ account: ACCOUNT, calls: [{ functionName: "allocate", args: [5n] }] }),
    );
  });

  it("stays deterministic for arguments that do not encode, instead of throwing during render", () => {
    const build = () =>
      getGaslessBatchFeeQuoteQueryKey({ account: ACCOUNT, calls: [{ functionName: "allocate", args: ["five"] }] });

    expect(build).not.toThrow();
    expect(build()).toEqual(build());
  });
});

describe("getGaslessBatchFeeQuoteQueryOptions", () => {
  it("quotes through the GaslessLayer and reports an encoding failure as the query's error", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(rawFeeQuote(ACCOUNT));

    const options = getGaslessBatchFeeQuoteQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: ACCOUNT,
      calls: [{ functionName: "allocate", args: [5n] }],
    });
    expect(options.enabled).toBe(true);
    await expect(options.queryFn()).resolves.toMatchObject({ totalFee18: 50_000_000_000_000_000n });
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "previewFeeQuote" }));

    const broken = getGaslessBatchFeeQuoteQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: ACCOUNT,
      calls: [{ functionName: "allocate", args: ["five"] }],
    });
    await expect(broken.queryFn()).rejects.toThrow();
  });
});
