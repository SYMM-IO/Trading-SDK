import { createConfig } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { createServer, type Server } from "node:http";
import type { PublicClient } from "viem";
import { afterEach, expect, it } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useAllSymbols } from "./use-all-symbols";
import { useEnigmaFundingInfo } from "./use-enigma-funding-info";

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
      42161: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        solvers: { enigma: { url: `http://127.0.0.1:${address.port}` } },
      },
    },
  });
}

it("runs the real catalog action and query factory through the React binding", async () => {
  const requested: number[] = [];
  const config = await serve((url) => {
    const offset = Number(url.searchParams.get("offset"));
    requested.push(offset);
    return {
      body: {
        count: 2,
        symbols: [
          {
            symbol_id: offset + 1,
            name: `DUP::${offset}`,
            symbol: "DUP",
            is_valid: true,
            state_long: 3,
            state_short: 1,
          },
        ],
      },
    };
  });
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
  const config = await serve(() => {
    requests++;
    return { status: 503, body: { error: "offline" } };
  });
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
