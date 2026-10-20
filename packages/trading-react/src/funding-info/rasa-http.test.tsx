import type { RasaMarketFundingInfo } from "@symmio/trading-core";
import { createConfig } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { createServer, type Server } from "node:http";
import type { PublicClient } from "viem";
import { afterEach, expect, expectTypeOf, it } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useFundingInfo } from "./use-funding-info";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

async function serve(read: (url: URL) => { status?: number; body: unknown }) {
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    const result = read(new URL(request.url!, "http://127.0.0.1"));
    response.writeHead(result.status ?? 200, {
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify(result.body));
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP test server");
  return createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: {
      8453: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        solvers: { rasa: { url: `http://127.0.0.1:${address.port}` } },
      },
    },
  });
}

it("reads Rasa on Base through the real hook and retains ticker filtering and units", async () => {
  const requests: string[] = [];
  const config = await serve((url) => {
    requests.push(url.pathname + url.search);
    return {
      body: {
        BTCUSDT: {
          next_funding_rate_long: "0.001",
          next_funding_rate_short: "-0.002",
          next_funding_time: 1792483200000,
          funding_rate_epoch_duration: 14400,
        },
      },
    };
  });
  const { result } = renderHookWithProviders(() =>
    useFundingInfo({ config, chainId: 8453, solverId: "rasa", symbols: ["BTCUSDT"] }),
  );
  expectTypeOf(result.current.data).toEqualTypeOf<RasaMarketFundingInfo[] | undefined>();
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(requests).toEqual(["/get_funding_info?symbols=BTCUSDT"]);
  expect(result.current.data).toEqual([
    {
      kind: "rasa",
      symbol: "BTCUSDT",
      nextFundingRateLong: 0.001,
      nextFundingRateShort: -0.002,
      nextFundingTime: 1792483200000,
      epochDurationSeconds: 14400,
    },
  ]);
});
it("normalizes Rasa HTTP failures in the hook", async () => {
  const config = await serve(() => ({ status: 503, body: { message: "unavailable" } }));
  const { result } = renderHookWithProviders(() => useFundingInfo({ config, chainId: 8453, query: { retry: false } }));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toMatchObject({ kind: "api", code: "FETCH_FUNDING_INFO_FAILED" });
});
