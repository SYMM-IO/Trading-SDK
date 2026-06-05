import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useDeposit } from "./use-deposit";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useDeposit", () => {
  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });
    const { result } = renderHookWithProviders(() => useDeposit({ config, waitForReceipt: false }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: 1_000000n });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("writes depositForAccount and returns the tx hash when waitForReceipt is false", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useDeposit({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: 1_000000n });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "depositForAccount", args: [SUB_ACCOUNT, 1_000000n] }),
    );
  });
});
