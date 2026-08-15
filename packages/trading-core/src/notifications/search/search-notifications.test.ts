import axios from "axios";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { NotificationSearchFilter } from "../types";
import { searchNotifications } from "./search-notifications";

const SEARCH_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solvers.enigma!.notifications.searchUrl;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const FILTER: NotificationSearchFilter = {
  app_name: "Base_Superflow_Stage",
  "data.temp_quote_id": -172,
};

const RESPONSE = {
  data: {
    total: 1,
    count: 1,
    data: [{ id: "n1", app_name: "Base_Superflow_Stage", data: { temp_quote_id: -172, quote_id: 0 } }],
  },
};

describe("searchNotifications", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the filter as `query` to the chain's search URL and normalizes the response", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue(RESPONSE);

    const result = await searchNotifications(config, { filter: FILTER, size: 50, start: 10 });

    expect(post).toHaveBeenCalledWith(
      "/api/v1/search",
      { query: FILTER, size: 50, start: 10 },
      expect.objectContaining({ baseURL: SEARCH_URL }),
    );
    expect(result).toEqual({ kind: "enigma", total: 1, count: 1, rows: RESPONSE.data.data });
  });

  it("returns an empty document list when the service omits `data`", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { total: 0, count: 0 } });
    expect(await searchNotifications(config, { filter: FILTER })).toEqual({
      kind: "enigma",
      total: 0,
      count: 0,
      rows: [],
    });
  });

  it("prefers a per-call `baseUrl` over the chain config", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue(RESPONSE);
    await searchNotifications(config, { filter: FILTER, baseUrl: "https://example.test/notification" });
    expect(post).toHaveBeenCalledWith(
      "/api/v1/search",
      expect.anything(),
      expect.objectContaining({ baseURL: "https://example.test/notification" }),
    );
  });

  it("throws a SymmError when no search URL is configured and no baseUrl is passed", async () => {
    const unconfigured = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
          solvers: { enigma: { notifications: { searchUrl: "" } } },
        },
      },
    });
    await expect(searchNotifications(unconfigured, { filter: FILTER })).rejects.toBeInstanceOf(SymmError);
    await expect(searchNotifications(unconfigured, { filter: FILTER })).rejects.toThrow(
      "No notification search URL is configured",
    );
  });

  it("wraps request failures in a SymmError", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("Network error"));
    await expect(searchNotifications(config, { filter: FILTER })).rejects.toBeInstanceOf(SymmError);
    await expect(searchNotifications(config, { filter: FILTER })).rejects.toThrow("Failed to search notifications");
  });
});
