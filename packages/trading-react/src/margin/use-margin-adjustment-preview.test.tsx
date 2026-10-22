import type { Config, GetMarginAdjustmentPreviewParameters, MarginAdjustmentPreview } from "@symmio/trading-core";
import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMarginAdjustmentPreview } from "./use-margin-adjustment-preview";

const read = vi.hoisted(() => vi.fn());
vi.mock("@symmio/trading-core", async (original) => {
  const actual = await original<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getMarginAdjustmentPreviewQueryOptions: (config: Config, parameters: GetMarginAdjustmentPreviewParameters) => ({
      ...actual.getMarginAdjustmentPreviewQueryOptions(config, parameters),
      queryFn: () => read(parameters),
    }),
  };
});
const address = "0x1111111111111111111111111111111111111111";
function inputs(): GetMarginAdjustmentPreviewParameters {
  return {
    chainId: 42161,
    owner: address,
    signer: address,
    subAccount: address,
    virtualAccount: address,
    direction: "add",
    amount: 1n,
    mark: { price: 2n, updatedAt: Date.now() },
    maxPriceAgeMs: 30_000,
    closeFeeReserveBufferBps: 10,
  };
}
beforeEach(() => {
  read.mockReset();
});

it("normalizes failed simulation and never substitutes a zero preview", async () => {
  const { config } = createMockSymmioConfig();
  read.mockRejectedValue(new Error("simulation reverted"));
  const parameters = inputs();
  const { result } = renderHookWithProviders(() => useMarginAdjustmentPreview({ ...parameters, config }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
  expect(result.current.error?.message).toContain("simulation reverted");
  expect(read).toHaveBeenCalledOnce();
});

it("discards a delayed response from the previously selected VA", async () => {
  const { config } = createMockSymmioConfig();
  let resolveOld!: (value: MarginAdjustmentPreview) => void;
  read
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockResolvedValueOnce({ snapshotIdentity: "new" });
  let parameters = inputs();
  const { result, rerender } = renderHookWithProviders(() => useMarginAdjustmentPreview({ ...parameters, config }));
  parameters = { ...parameters, virtualAccount: "0x2222222222222222222222222222222222222222" };
  rerender();
  await waitFor(() => expect(result.current.data?.snapshotIdentity).toBe("new"));
  await act(async () => resolveOld({ snapshotIdentity: "old" } as MarginAdjustmentPreview));
  expect(result.current.data?.snapshotIdentity).toBe("new");
  expect(read).toHaveBeenCalledTimes(2);
});

it("marks a stale supplied price unavailable even when query data exists", async () => {
  const { config } = createMockSymmioConfig();
  read.mockResolvedValue({ snapshotIdentity: "stale" });
  const parameters = { ...inputs(), mark: { price: 2n, updatedAt: Date.now() - 30_001 } };
  const { result } = renderHookWithProviders(() => useMarginAdjustmentPreview({ ...parameters, config }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.isFresh).toBe(false);
});

it("never inherits host placeholder data across account changes", async () => {
  const { config } = createMockSymmioConfig();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { placeholderData: keepPreviousData, retry: false } },
  });
  read.mockResolvedValueOnce({ snapshotIdentity: "old" }).mockReturnValueOnce(new Promise(() => {}));
  let parameters = inputs();
  const { result, rerender } = renderHookWithProviders(() => useMarginAdjustmentPreview({ ...parameters, config }), {
    queryClient,
  });
  await waitFor(() => expect(result.current.data?.snapshotIdentity).toBe("old"));
  parameters = { ...parameters, virtualAccount: "0x2222222222222222222222222222222222222222" };
  rerender();
  expect(result.current.data).toBeUndefined();
  expect(result.current.isPending).toBe(true);
});
