import axios, { type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { getListingMarkets } from "./get-listing-markets";
import { getListingMarketsQueryKey, getListingMarketsQueryOptions } from "./query";

const originalAdapter = axios.defaults.adapter;

afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

describe("listing lock filter through the generated client", () => {
  it.each([true, false, undefined])("preserves server pagination for isLocked=%s", async (isLocked) => {
    const { config } = mockConfig();
    const adapter = vi.fn(async (request: InternalAxiosRequestConfig) => {
      const url = new URL(axios.getUri(request));
      expect(url.pathname).toBe("/v2/market/search");
      expect(url.searchParams.get("is_locked")).toBe(isLocked === undefined ? null : String(isLocked));
      expect(url.searchParams.get("limit")).toBe("20");
      expect(url.searchParams.get("offset")).toBe("40");
      expect(url.searchParams.get("query")).toBe("token");
      return {
        data: { total: 73, limit: 20, offset: 40, items: [] },
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    });
    axios.defaults.adapter = adapter;

    const result = await getListingMarkets(config, { isLocked, search: "token", limit: 20, offset: 40 });

    expect(result).toEqual({ total: 73, limit: 20, offset: 40, items: [] });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])("forwards isLocked=%s from query options", async (isLocked) => {
    const { config } = mockConfig();
    axios.defaults.adapter = async (request) => {
      expect(new URL(axios.getUri(request)).searchParams.get("is_locked")).toBe(String(isLocked));
      return { data: { total: 1, items: [] }, status: 200, statusText: "OK", headers: {}, config: request };
    };
    await getListingMarketsQueryOptions(config, { isLocked }).queryFn();
  });

  it("keeps locked, unlocked and unfiltered catalogs in distinct cache entries", () => {
    const unlocked = getListingMarketsQueryKey({ configKey: "listing", isLocked: false });
    const locked = getListingMarketsQueryKey({ configKey: "listing", isLocked: true });
    const unfiltered = getListingMarketsQueryKey({ configKey: "listing" });
    expect(unlocked).not.toEqual(locked);
    expect(unlocked).not.toEqual(unfiltered);
    expect(locked).not.toEqual(unfiltered);
  });
});
