import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidateTpSlReads } from "./invalidate-tpsl";

/** Build a client whose `invalidateQueries` records the predicate it was given. */
function clientWithSpy() {
  const client = new QueryClient();
  const spy = vi.fn().mockResolvedValue(undefined);
  client.invalidateQueries = spy as unknown as QueryClient["invalidateQueries"];
  return { client, spy };
}

/** A minimal query object shaped like what the predicate receives. */
function query(queryKey: unknown) {
  return { queryKey } as unknown as Parameters<
    NonNullable<Parameters<QueryClient["invalidateQueries"]>[0]>["predicate"] extends (q: infer Q) => unknown
      ? Q
      : never
  >[0];
}

describe("invalidateTpSlReads", () => {
  it("matches getQuoteTpSl reads for the given quote ids", async () => {
    const { client, spy } = clientWithSpy();

    await invalidateTpSlReads(client, [1n, 2n]);

    const predicate = spy.mock.calls[0]![0].predicate as (q: unknown) => boolean;
    expect(predicate(query(["getQuoteTpSl", { quoteId: "1" }]))).toBe(true);
    expect(predicate(query(["getQuoteTpSl", { quoteId: "2" }]))).toBe(true);
    expect(predicate(query(["getQuoteTpSl", { quoteId: "3" }]))).toBe(false);
  });

  it("ignores unrelated queries and other quotes", async () => {
    const { client, spy } = clientWithSpy();

    await invalidateTpSlReads(client, [7n]);

    const predicate = spy.mock.calls[0]![0].predicate as (q: unknown) => boolean;
    expect(predicate(query(["getQuote", { quoteId: "7" }]))).toBe(false);
    expect(predicate(query(["getQuoteTpSl", { quoteId: "8" }]))).toBe(false);
    expect(predicate(query(["getQuoteTpSl"]))).toBe(false);
    expect(predicate(query("nonsense"))).toBe(false);
  });

  it("skips the 0n sentinel and no-ops on an empty set", async () => {
    const { client, spy } = clientWithSpy();

    await invalidateTpSlReads(client, [0n]);

    expect(spy).not.toHaveBeenCalled();
  });
});
