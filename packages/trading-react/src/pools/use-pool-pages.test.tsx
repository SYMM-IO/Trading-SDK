import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderHookWithProviders } from "../test/test-utils";
import { usePoolPages } from "./use-pool-pages";
type Page = { count: number; items: { id: string }[] };
describe("composed source pagination", () => {
  it("advances by the returned rows when the backend caps page size", async () => {
    const fetch = vi.fn(async (offset: number): Promise<Page> => ({ count: 3, items: [{ id: String(offset) }] }));
    const { result } = renderHookWithProviders(() =>
      usePoolPages({
        source: "deposits",
        pageSize: 100,
        enabled: true,
        identity: (row) => row.id,
        selectPage: (page: Page) => ({ items: page.items, total: page.count }),
        options: (offset) => ({ queryKey: ["short-pages", offset], queryFn: () => fetch(offset) }),
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch.mock.calls.map(([offset]) => offset)).toEqual([0, 1, 2]);
    expect(result.current.items).toEqual([{ id: "0" }, { id: "1" }, { id: "2" }]);
    expect(result.current.gaps).toEqual([]);
  });
  it("retains earlier pages after a later failure", async () => {
    const fetch = vi.fn(async (offset: number): Promise<Page> => {
      if (offset > 0) throw Error("offline");
      return { count: 2, items: [{ id: "funded-pool" }] };
    });
    const { result } = renderHookWithProviders(() =>
      usePoolPages({
        source: "deposits",
        pageSize: 1,
        enabled: true,
        identity: (row) => row.id,
        selectPage: (page: Page) => ({ items: page.items, total: page.count }),
        options: (offset) => ({ queryKey: ["failed-page", offset], queryFn: () => fetch(offset) }),
      }),
    );
    await waitFor(() => expect(result.current.gaps).toEqual([{ source: "deposits", reason: "failed" }]));
    expect(result.current.items).toEqual([{ id: "funded-pool" }]);
  });
  it("does not refetch a disabled source", async () => {
    const fetch = vi.fn(async (): Promise<Page> => ({ count: 0, items: [] }));
    const { result } = renderHookWithProviders(() =>
      usePoolPages({
        source: "pending",
        pageSize: 50,
        enabled: false,
        identity: (row) => row.id,
        selectPage: (page: Page) => ({ items: page.items, total: page.count }),
        options: (offset) => ({ queryKey: ["disabled-page", offset], queryFn: fetch }),
      }),
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("caps a large source at ten pages and reports truncation", async () => {
    const fetch = vi.fn(async (offset: number): Promise<Page> => ({ count: 15, items: [{ id: String(offset) }] }));
    const { result } = renderHookWithProviders(() =>
      usePoolPages({
        source: "deposits",
        pageSize: 1,
        enabled: true,
        identity: (row) => row.id,
        selectPage: (page: Page) => ({ items: page.items, total: page.count }),
        options: (offset) => ({ queryKey: ["pages", offset], queryFn: () => fetch(offset) }),
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(10);
    expect(result.current.items).toHaveLength(10);
    expect(result.current.gaps).toEqual([{ source: "deposits", reason: "truncated" }]);
  });
  it("stops when the backend repeats a page and resets on identity changes", async () => {
    let wallet = "A";
    // Keep the host QueryClient stable across rerenders, as in a real provider.
    const queryClient = createTestQueryClient();
    const fetch = vi.fn(async (): Promise<Page> => ({ count: 50, items: [{ id: wallet }] }));
    const { result, rerender } = renderHookWithProviders(
      () =>
        usePoolPages({
          source: "deposits",
          pageSize: 1,
          enabled: true,
          identity: (row) => row.id,
          selectPage: (page: Page) => ({ items: page.items, total: page.count }),
          options: (offset) => ({ queryKey: ["pages", wallet, offset], queryFn: fetch }),
        }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.gaps).toEqual([{ source: "deposits", reason: "repeated-page" }]));
    expect(fetch).toHaveBeenCalledTimes(2);
    wallet = "B";
    rerender();
    await waitFor(() => expect(result.current.items).toEqual([{ id: "B" }]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
