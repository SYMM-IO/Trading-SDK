import {
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getChainConfig,
  getQuoteQueryKey,
  SymmioSupportedChainId,
} from "@symmio/trading-core";
import type { Query, QueryKey } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  createMockSymmioConfig,
  createTestQueryClient,
  renderHookWithProviders,
  TEST_TX_HASH,
} from "../test/test-utils";
import { useForceCancelQuote } from "./use-force-cancel-quote";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const QUOTE_ID = 42n;

describe("useForceCancelQuote", () => {
  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });

    const { result } = renderHookWithProviders(() => useForceCancelQuote({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: SUB_ACCOUNT, quoteId: QUOTE_ID });
      } catch (err) {
        error = err;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("writes forceCancelQuote via _call and returns the tx hash when waitForReceipt is false", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useForceCancelQuote({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, quoteId: QUOTE_ID });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    const call = writeContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args[0]).toBe(SUB_ACCOUNT);
    expect(call.args[1]).toHaveLength(1);
  });

  it("waits for the receipt by default", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" });

    const { result } = renderHookWithProviders(() => useForceCancelQuote({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, quoteId: QUOTE_ID });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH, receipt: { status: "success" } });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 1 });
  });

  it("invalidates the subaccount balance reads for the active config on success", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" });
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useForceCancelQuote({ config }), { queryClient });

    await act(async () => {
      await result.current.mutateAsync({ account: SUB_ACCOUNT, quoteId: QUOTE_ID });
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const configKey = config.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM);
    /** Run every predicate the mutation handed to `invalidateQueries` against one key. */
    const matches = (key: QueryKey) =>
      invalidate.mock.calls.some(([filters]) => {
        const { predicate } = filters as { predicate: (q: Query) => boolean };
        return predicate({ queryKey: key } as Query<unknown, Error, unknown, QueryKey>);
      });

    /** A cancel refunds the open trading fee and releases the reserved margin. */
    expect(matches(getAccountBalanceOfQueryKey({ configKey, account: SUB_ACCOUNT }))).toBe(true);
    expect(matches(getAccountBalanceInfoQueryKey({ configKey, account: SUB_ACCOUNT }))).toBe(true);
    /** The read carrying `quoteStatus` — without it the row keeps its pre-cancel status. */
    expect(matches(getQuoteQueryKey({ configKey, quoteId: QUOTE_ID }))).toBe(true);
    /** Another chain config's balances must survive. */
    expect(matches(getAccountBalanceOfQueryKey({ configKey: "other", account: SUB_ACCOUNT }))).toBe(false);
  });
});
