import { QueryClient } from "@tanstack/query-core";
import { createServer, type Server } from "node:http";
import type { PublicClient } from "viem";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { getEstimatedPrice } from "./get-estimated-price";
import { getEstimatedPriceQueryKey, getEstimatedPriceQueryOptions } from "./query";

let server: Server;
let baseURL: string;
const requests: string[] = [];
let hang = false;
let abortedRequests = 0;
let status = 200;
let body: unknown = { price: "0.123456789012345678" };
const input = {
  chainId: 42161,
  symbolId: 42,
  quantity: "1000.000000000000000001",
  price: "0.12",
  positionType: PositionType.SHORT,
  entry: "close" as const,
};

beforeEach(async () => {
  requests.length = 0;
  hang = false;
  abortedRequests = 0;
  status = 200;
  body = { price: "0.123456789012345678" };
  server = createServer((request, response) => {
    requests.push(request.url!);
    request.on("aborted", () => {
      abortedRequests += 1;
    });
    if (hang) return;
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  baseURL = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function config() {
  return createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: {
      42161: {
        addresses: { affiliatesAddress: "0x0000000000000000000000000000000000000000" },
        solvers: { enigma: { url: baseURL } },
      },
    },
  });
}

it("preserves exact decimals and side/entry without a cancellation signal", async () => {
  expect(await getEstimatedPrice(config(), input)).toEqual({ estimatedPrice: "0.123456789012345678" });
  const url = new URL(requests[0]!, baseURL);
  expect(Object.fromEntries(url.searchParams)).toEqual({
    symbol_id: "42",
    quantity: input.quantity,
    price: "0.12",
    position_type: "short",
    entry: "close",
  });
});

it("rejects an already aborted request without contacting the solver", async () => {
  await expect(getEstimatedPrice(config(), { ...input, signal: AbortSignal.abort() })).rejects.toBeInstanceOf(
    SymmError,
  );
  expect(requests).toHaveLength(0);
});

it("aborts an in-flight request and permits a later request", async () => {
  hang = true;
  const controller = new AbortController();
  const pending = getEstimatedPrice(config(), { ...input, signal: controller.signal });
  const rejection = expect(pending).rejects.toBeInstanceOf(SymmError);
  await expect.poll(() => requests.length).toBe(1);
  controller.abort();
  await rejection;
  await expect.poll(() => abortedRequests).toBe(1);
  hang = false;
  expect(await getEstimatedPrice(config(), input)).toHaveProperty("estimatedPrice", "0.123456789012345678");
});

it("normalizes HTTP failures and unavailable business responses", async () => {
  status = 503;
  await expect(getEstimatedPrice(config(), input)).rejects.toBeInstanceOf(SymmError);
  status = 200;
  body = { code: 3402, error_detail: "Amount Exceeded" };
  expect(await getEstimatedPrice(config(), input)).toEqual({ estimatedPrice: "0" });
});

it("keeps signals out of cache identity", () => {
  expect(getEstimatedPriceQueryKey({ ...input, signal: new AbortController().signal })).toEqual(
    getEstimatedPriceQueryKey(input),
  );
});

it("forwards TanStack cancellation to the HTTP request", async () => {
  hang = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const options = getEstimatedPriceQueryOptions(config(), input);
  const pending = client.fetchQuery(options);
  const rejection = expect(pending).rejects.toThrow();
  await expect.poll(() => requests.length).toBe(1);
  await client.cancelQueries({ queryKey: options.queryKey });
  await rejection;
  await expect.poll(() => abortedRequests).toBe(1);
  client.clear();
});
