import { PositionType, SymmApiError, SymmError, type Config } from "@symmio/trading-core";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, createTestQueryClient, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { __resetTpSlStore, useTpSlStore } from "./tpsl-store";
import { useDeleteQuoteTpSl } from "./use-delete-quote-tpsl";
import { useSetQuoteTpSl } from "./use-set-quote-tpsl";

const write = vi.hoisted(() => vi.fn());
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    // Keep the actual factory policy; stub only the signed write result.
    setQuoteTpSlMutationOptions: (config: Config) => ({
      ...actual.setQuoteTpSlMutationOptions(config),
      mutationFn: write,
    }),
    deleteQuoteTpSlMutationOptions: (config: Config) => ({
      ...actual.deleteQuoteTpSlMutationOptions(config),
      mutationFn: write,
    }),
  };
});

describe.each(["set", "delete"] as const)("%s TP/SL hook retries", (operation) => {
  afterEach(() => {
    write.mockReset();
    __resetTpSlStore();
  });

  it.each(["malformed", "transport"])(
    "preserves the core retry policy after normalizing %s errors",
    async (outcome) => {
      const { config } = createMockSymmioConfig();
      const queryClient = createTestQueryClient();
      queryClient.setDefaultOptions({ mutations: { retry: 3, retryDelay: 0, gcTime: 0 } });
      const code = `${operation.toUpperCase()}_TPSL_${outcome === "malformed" ? "INVALID_RESPONSE" : "FAILED"}`;
      write.mockRejectedValue(
        outcome === "malformed"
          ? new SymmError("api", code, "Acknowledgment missing")
          : new SymmApiError({
              code,
              message: "Response lost",
              status: 0,
              statusText: "",
              method: operation === "set" ? "POST" : "DELETE",
              url: "https://handler.invalid",
            }),
      );
      const invalidation = vi.spyOn(queryClient, "invalidateQueries");
      const { result, unmount } = renderHookWithProviders(
        () => ({
          set: useSetQuoteTpSl({ config }),
          delete: useDeleteQuoteTpSl({ config }),
        }),
        { queryClient },
      );
      try {
        await act(async () => {
          const execution =
            operation === "set"
              ? result.current.set.mutateAsync({
                  quoteId: -123n,
                  virtualAccount: TEST_EOA,
                  subAccount: TEST_EOA,
                  symbolId: 1n,
                  positionType: PositionType.LONG,
                  quantity: "5",
                  pricePrecision: 4,
                  tp: { triggerPrice: "12", priceType: "markPrice" },
                })
              : result.current.delete.mutateAsync({
                  quoteId: -123n,
                  virtualAccount: TEST_EOA,
                  cohQuoteId: "coh1",
                  conditionalOrderType: "take_profit",
                });
          await expect(execution).rejects.toMatchObject({ code });
        });
        expect(write).toHaveBeenCalledTimes(1);
        expect(invalidation).not.toHaveBeenCalled();
        expect(useTpSlStore.getState().records.size).toBe(0);
      } finally {
        unmount();
        queryClient.clear();
      }
    },
  );
});
