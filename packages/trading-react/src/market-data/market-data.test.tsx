import { waitFor } from "@testing-library/react";
import type { AxiosAdapter, AxiosStatic } from "axios";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useAllSymbols } from "./use-all-symbols";
import { useEnigmaFundingInfo } from "./use-enigma-funding-info";

const sdkRequire = createRequire(import.meta.resolve("@symmio/trading-core"));
const axiosUrl = pathToFileURL(join(dirname(sdkRequire.resolve("axios/package.json")), "index.js")).href;
const { default: axios }: { default: AxiosStatic } = await import(axiosUrl);
const previous = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = previous;
});

it("runs the real catalog action and query factory through the React binding", async () => {
  const requested: number[] = [];
  const adapter: AxiosAdapter = async (request) => {
    requested.push(request.params.offset);
    return {
      data: {
        count: 2,
        symbols: [
          {
            symbol_id: request.params.offset + 1,
            name: `DUP::${request.params.offset}`,
            symbol: "DUP",
            is_valid: true,
            state_long: 3,
            state_short: 1,
          },
        ],
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: request,
    };
  };
  axios.defaults.adapter = adapter;
  const { config } = createMockSymmioConfig();
  const { result } = renderHookWithProviders(() => useAllSymbols({ config, chainId: 42161, query: { retry: false } }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(requested).toEqual([0, 1]);
  expect(result.current.data?.map((row) => [row.symbolId, row.stateShort])).toEqual([
    [1, 1],
    [2, 1],
  ]);
});

it("normalizes a real action failure and respects disabled queries", async () => {
  let requests = 0;
  axios.defaults.adapter = async () => {
    requests++;
    throw new Error("offline");
  };
  const { config } = createMockSymmioConfig();
  const { result, rerender } = renderHookWithProviders(
    ({ enabled }) => useEnigmaFundingInfo({ config, chainId: 42161, query: { enabled, retry: false } }),
    { initialProps: { enabled: false } },
  );
  expect(requests).toBe(0);
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toHaveProperty("kind");
  expect(requests).toBe(1);
});
