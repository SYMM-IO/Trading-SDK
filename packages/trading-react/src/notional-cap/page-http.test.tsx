import { createConfig } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { createServer, type Server } from "node:http";
import type { PublicClient } from "viem";
import { afterEach, expect, it } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useNotionalCapPage } from "./use-notional-cap-page";

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

it("runs the real page action, includes paging in the query identity, and changes pages", async () => {
  const requested: number[] = [];
  const config = await serve((url) => {
    const offset = Number(url.searchParams.get("offset"));
    requested.push(offset);
    return { body: { count: 1, total_used: 1.5, symbols: [{ symbol_id: offset + 1, used: 1.5 }] } };
  });
  const { result, rerender } = renderHookWithProviders(
    ({ offset }) =>
      useNotionalCapPage({
        config,
        chainId: 42161,
        limit: 25,
        offset,
        pollingInterval: false,
        query: { retry: false },
      }),
    { initialProps: { offset: 0 } },
  );
  await waitFor(() => expect(result.current.data?.symbols[0]?.symbolId).toBe(1));
  rerender({ offset: 25 });
  await waitFor(() => expect(result.current.data?.symbols[0]?.symbolId).toBe(26));
  expect(requested).toEqual([0, 25]);
});
it("normalizes a real action failure and respects disabled queries", async () => {
  let requests = 0;
  const config = await serve(() => {
    requests++;
    return { status: 503, body: { error: "offline" } };
  });
  const { result, rerender } = renderHookWithProviders(
    ({ enabled }) => useNotionalCapPage({ config, chainId: 42161, query: { enabled, retry: false } }),
    { initialProps: { enabled: false } },
  );
  expect(requests).toBe(0);
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toHaveProperty("kind");
  expect(requests).toBe(1);
});
