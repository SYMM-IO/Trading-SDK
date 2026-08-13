import axios, { type AxiosResponse } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";
import { searchTpSlOrdersQueryKey, searchTpSlOrdersQueryOptions } from "./query";

function okResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} } as AxiosResponse["config"],
  } as AxiosResponse<T>;
}

describe("searchTpSlOrdersQueryKey", () => {
  it("tags the key and carries the account so two accounts never share a cache entry", () => {
    const other = "0x00000000000000000000000000000000000000b2" as const;

    const key = searchTpSlOrdersQueryKey({ account: TEST_USER, configKey: "hyperEvm" });
    const otherKey = searchTpSlOrdersQueryKey({ account: other, configKey: "hyperEvm" });

    expect(key[0]).toBe("searchTpSlOrders");
    expect(key[1]).toMatchObject({ account: TEST_USER, configKey: "hyperEvm" });
    expect(key).not.toEqual(otherKey);
  });

  it("separates entries that differ only by filter, so a narrowed search cannot serve a broad one", () => {
    const broad = searchTpSlOrdersQueryKey({ account: TEST_USER, configKey: "hyperEvm" });
    const narrow = searchTpSlOrdersQueryKey({ account: TEST_USER, symbolId: 4, configKey: "hyperEvm" });

    expect(broad).not.toEqual(narrow);
  });
});

describe("searchTpSlOrdersQueryOptions", () => {
  it("is disabled without an account — the filter is what scopes the sweep", () => {
    const { config } = mockConfig();

    const options = searchTpSlOrdersQueryOptions(config, { account: undefined as unknown as typeof TEST_USER });

    expect(options.enabled).toBe(false);
  });

  it("is enabled with an account and runs the action", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "post").mockResolvedValue(okResponse({ data: [], count: 0 }));

    const options = searchTpSlOrdersQueryOptions(config, { account: TEST_USER });

    expect(options.enabled).toBe(true);
    await expect(options.queryFn()).resolves.toMatchObject({ orders: [], count: 0, isComplete: true });
    vi.restoreAllMocks();
  });

  it("honors an explicit `query.enabled: false`", () => {
    const { config } = mockConfig();

    const options = searchTpSlOrdersQueryOptions(config, { account: TEST_USER, query: { enabled: false } });

    expect(options.enabled).toBe(false);
  });
});
