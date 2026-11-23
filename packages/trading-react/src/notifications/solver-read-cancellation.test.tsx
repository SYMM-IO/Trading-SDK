import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSolverInfo } from "../solvers/use-solver-info";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSearchNotifications } from "./use-search-notifications";
const queryFn = vi.hoisted(() => vi.fn());
vi.mock("@symmio/trading-core", async (original) => {
  const actual = await original<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getSolverInfoQueryOptions: () => ({ queryKey: ["getSolverInfo"], queryFn }),
    searchNotificationsQueryOptions: () => ({ queryKey: ["searchNotifications"], queryFn }),
  };
});
beforeEach(() => {
  queryFn.mockReset();
});
describe("automatic solver read cancellation", () => {
  it.each([useSolverInfo, useSearchNotifications])(
    "aborts factory context when the query is cancelled",
    async (hook) => {
      const { config } = createMockSymmioConfig();
      const queryClient = new QueryClient();
      let signal: AbortSignal | undefined;
      queryFn.mockImplementation((context: { signal: AbortSignal }) => {
        signal = context.signal;
        return new Promise(() => {});
      });
      renderHookWithProviders(() => hook({ config, chainId: 42161 }), { queryClient });
      await waitFor(() => expect(signal).toBeDefined());
      await queryClient.cancelQueries();
      expect(signal!.aborted).toBe(true);
    },
  );
});
