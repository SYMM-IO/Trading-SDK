import {
  createConfig,
  GaslessFeeSource,
  gaslessLayerAbi,
  symmioAbi,
  SymmioSupportedChainId,
} from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { decodeFunctionData, type Hex, type PublicClient } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useGaslessBatchFeeQuote } from "./use-gasless-batch-fee-quote";

const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
/** A synthetic GaslessLayer address — reads go to the stub client, never to a chain. */
const GASLESS_LAYER = "0x000000000000000000000000000000000000ea51" as const;

function buildConfig() {
  const readContract = vi.fn();
  const config = createConfig({
    getClient: () => ({ readContract }) as unknown as PublicClient,
    symmioConfig: {
      [arbitrum.id]: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        gasless: {
          url: "https://gaslessq-staging.symmio.foundation",
          protocolInstance: "arbitrum-42161-test",
          gaslessLayerAddress: GASLESS_LAYER,
        },
      },
    },
  });
  return { config, readContract };
}

const QUOTE = {
  collateralToken: "0x000000000000000000000000000000000000c011",
  collateralDecimals: 6,
  blockNumber: 1n,
  timestamp: 2n,
  exact: false,
  payments: [
    {
      account: SUB_ACCOUNT,
      payer: SUB_ACCOUNT,
      source: GaslessFeeSource.SYMMIO_ACCOUNT,
      operationalFee18: 50_000_000_000_000_000n,
      depositFee18: 0n,
      walletCreationFee18: 0n,
      nativeTopUpFee18: 0n,
      nativeGasCollateral18: 0n,
    },
  ],
  totalFee18: 50_000_000_000_000_000n,
  totalDebit18: 50_000_000_000_000_000n,
  freeOpsApplied: 0n,
  nativeSponsored: false,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The `allocate` amount of every batch the stub was asked to preview, in order. */
function quotedAmounts(readContract: ReturnType<typeof buildConfig>["readContract"]): bigint[] {
  return readContract.mock.calls
    .map(([read]) => read as { functionName: string; args: readonly [Hex, bigint] })
    .filter((read) => read.functionName === "previewFeeQuote")
    .map((read) => {
      const batch = decodeFunctionData({ abi: gaslessLayerAbi, data: read.args[0] });
      if (batch.functionName !== "relayInstantBatch") throw new Error(`unexpected ${batch.functionName}`);
      const write = decodeFunctionData({ abi: symmioAbi, data: batch.args[0][0]!.callData });
      return write.args?.[0] as bigint;
    });
}

describe("useGaslessBatchFeeQuote", () => {
  it("previews the batch on the connected chain's GaslessLayer", async () => {
    const { config, readContract } = buildConfig();
    readContract.mockResolvedValue(QUOTE);

    const { result } = renderHookWithProviders(() =>
      useGaslessBatchFeeQuote({ config, account: SUB_ACCOUNT, calls: [{ functionName: "allocate", args: [5n] }] }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalFee18).toBe(50_000_000_000_000_000n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: GASLESS_LAYER, functionName: "previewFeeQuote" }),
    );
  });

  it("re-quotes a changing batch once it holds still, not once per change", async () => {
    const { config, readContract } = buildConfig();
    readContract.mockResolvedValue(QUOTE);

    const { result, rerender } = renderHookWithProviders(
      ({ amount }: { amount: bigint }) =>
        useGaslessBatchFeeQuote({
          config,
          account: SUB_ACCOUNT,
          calls: [{ functionName: "allocate", args: [amount] }],
          debounceMs: 100,
        }),
      { initialProps: { amount: 1n } },
    );

    /** The first batch is quoted at once. */
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(quotedAmounts(readContract)).toEqual([1n]);

    rerender({ amount: 12n });
    rerender({ amount: 123n });
    await sleep(40);
    /** Still typing: the settled quote stays on screen and nothing is read. */
    expect(quotedAmounts(readContract)).toEqual([1n]);
    expect(result.current.data?.totalFee18).toBe(50_000_000_000_000_000n);

    await waitFor(() => expect(quotedAmounts(readContract)).toEqual([1n, 123n]));
  });

  it("does not restart the wait when an identical batch is rebuilt on every render", async () => {
    const { config, readContract } = buildConfig();
    readContract.mockResolvedValue(QUOTE);

    const { result, rerender } = renderHookWithProviders(
      ({ amount }: { amount: bigint }) =>
        useGaslessBatchFeeQuote({
          config,
          account: SUB_ACCOUNT,
          calls: [{ functionName: "allocate", args: [amount] }],
          debounceMs: 100,
        }),
      { initialProps: { amount: 1n } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    /**
     * Every render builds a fresh `calls` array with the same content, faster
     * than the delay. A wait keyed on identity would restart each time and
     * never settle; keyed on content, it settles 100 ms after the change.
     */
    rerender({ amount: 5n });
    for (let tick = 0; tick < 15; tick++) {
      await sleep(20);
      rerender({ amount: 5n });
    }

    expect(quotedAmounts(readContract)).toEqual([1n, 5n]);
  });

  it("quotes every change at once with debounceMs: 0", async () => {
    const { config, readContract } = buildConfig();
    readContract.mockResolvedValue(QUOTE);

    const { rerender } = renderHookWithProviders(
      ({ amount }: { amount: bigint }) =>
        useGaslessBatchFeeQuote({
          config,
          account: SUB_ACCOUNT,
          calls: [{ functionName: "allocate", args: [amount] }],
          debounceMs: 0,
        }),
      { initialProps: { amount: 1n } },
    );

    await waitFor(() => expect(quotedAmounts(readContract)).toEqual([1n]));
    rerender({ amount: 2n });
    await waitFor(() => expect(quotedAmounts(readContract)).toEqual([1n, 2n]));
  });

  it("normalizes a call the relayer cannot carry into an SDK SymmioRequestError", async () => {
    const { config, readContract } = buildConfig();

    const { result } = renderHookWithProviders(() =>
      useGaslessBatchFeeQuote({ config, account: SUB_ACCOUNT, calls: [{ functionName: "transfer", args: [] }] }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("GASLESS_NOT_RELAYABLE");
    expect(readContract).not.toHaveBeenCalled();
  });

  it("normalizes a chain without a gasless block into an SDK SymmioRequestError", async () => {
    const { config } = buildConfig();

    const { result } = renderHookWithProviders(() =>
      useGaslessBatchFeeQuote({
        config,
        chainId: SymmioSupportedChainId.BASE,
        account: SUB_ACCOUNT,
        calls: [{ functionName: "allocate", args: [5n] }],
      }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("GASLESS_NOT_CONFIGURED");
  });
});
