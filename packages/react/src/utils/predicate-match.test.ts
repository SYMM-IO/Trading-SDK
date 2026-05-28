import type { Query, QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { defineQueryKey } from "./define-query-key";
import { predicateMatch } from "./predicate-match";

/**
 * `predicateMatch` only reads `query.queryKey`, so a minimal stub cast to
 * `Query` is enough — building a real `Query` would drag in QueryClient
 * machinery that adds nothing to what we are testing.
 */
function queryWith(key: QueryKey): Query<unknown, Error, unknown, QueryKey> {
  return { queryKey: key } as Query<unknown, Error, unknown, QueryKey>;
}

interface SingleArg {
  chainId: number;
  user: string;
  offset?: bigint;
}

interface FirstArg {
  chainId: number;
}

interface SecondArg {
  user: string;
}

const ROOT = ["symmio", "account-layer"] as const;

describe("predicateMatch", () => {
  const builder = defineQueryKey<[SingleArg]>([...ROOT, "getUserSubAccounts"], (args) => [
    {
      chainId: args.chainId,
      user: args.user,
      offset: (args.offset ?? 0n).toString(),
    },
  ]);

  describe("prefix matching", () => {
    it("matches an entry produced by the builder when no partials are given", () => {
      const predicate = predicateMatch(builder);
      expect(predicate(queryWith(builder({ chainId: 1, user: "0xabc" })))).toBe(true);
    });

    it("rejects an entry whose prefix differs at any position", () => {
      const predicate = predicateMatch(builder);
      expect(predicate(queryWith(["symmio", "account-layer", "somethingElse", {}]))).toBe(false);
      expect(predicate(queryWith(["symmio", "other-slice", "getUserSubAccounts", {}]))).toBe(false);
    });

    it("rejects a key shorter than the prefix", () => {
      const predicate = predicateMatch(builder);
      expect(predicate(queryWith(["symmio", "account-layer"]))).toBe(false);
    });

    it("matches a key whose length equals the prefix when no partials are given", () => {
      const prefixOnly = defineQueryKey<[]>([...ROOT, "ping"], () => []);
      const predicate = predicateMatch(prefixOnly);
      expect(predicate(queryWith([...ROOT, "ping"]))).toBe(true);
    });
  });

  describe("partial field matching", () => {
    it("matches when every partial field equals the segment field", () => {
      const predicate = predicateMatch(builder, { user: "0xabc" });
      expect(predicate(queryWith(builder({ chainId: 1, user: "0xabc" })))).toBe(true);
      expect(predicate(queryWith(builder({ chainId: 999, user: "0xabc" })))).toBe(true);
    });

    it("rejects when a partial field differs from the segment field", () => {
      const predicate = predicateMatch(builder, { user: "0xabc" });
      expect(predicate(queryWith(builder({ chainId: 1, user: "0xdef" })))).toBe(false);
    });

    it("treats omitted partial fields as wildcards", () => {
      const predicate = predicateMatch(builder, { chainId: 1 });
      expect(predicate(queryWith(builder({ chainId: 1, user: "0xabc" })))).toBe(true);
      expect(predicate(queryWith(builder({ chainId: 1, user: "0xdef" })))).toBe(true);
    });

    it("treats `undefined` partial fields as wildcards", () => {
      const predicate = predicateMatch(builder, { chainId: 1, user: undefined });
      expect(predicate(queryWith(builder({ chainId: 1, user: "0xabc" })))).toBe(true);
      expect(predicate(queryWith(builder({ chainId: 2, user: "0xabc" })))).toBe(false);
    });

    it("compares bigint partial values as their decimal string form", () => {
      const predicate = predicateMatch(builder, { offset: 42n });
      expect(predicate(queryWith(builder({ chainId: 1, user: "0xabc", offset: 42n })))).toBe(true);
      expect(predicate(queryWith(builder({ chainId: 1, user: "0xabc", offset: 7n })))).toBe(false);
    });

    it("rejects when the matching segment is not a plain object", () => {
      const predicate = predicateMatch(builder, { user: "0xabc" });
      expect(predicate(queryWith([...ROOT, "getUserSubAccounts", "not-an-object"]))).toBe(false);
      expect(predicate(queryWith([...ROOT, "getUserSubAccounts", null]))).toBe(false);
      expect(predicate(queryWith([...ROOT, "getUserSubAccounts"]))).toBe(false);
    });
  });

  describe("multi-arg builders", () => {
    const twoArg = defineQueryKey<[FirstArg, SecondArg]>([...ROOT, "two"], (a, b) => [a, b]);

    it("lines up partials with cache-key segments by index", () => {
      const predicate = predicateMatch(twoArg, { chainId: 1 }, { user: "0xabc" });
      expect(predicate(queryWith(twoArg({ chainId: 1 }, { user: "0xabc" })))).toBe(true);
      expect(predicate(queryWith(twoArg({ chainId: 2 }, { user: "0xabc" })))).toBe(false);
      expect(predicate(queryWith(twoArg({ chainId: 1 }, { user: "0xdef" })))).toBe(false);
    });

    it("treats an `undefined` partial slot as a wildcard for that segment", () => {
      const predicate = predicateMatch(twoArg, undefined, { user: "0xabc" });
      expect(predicate(queryWith(twoArg({ chainId: 1 }, { user: "0xabc" })))).toBe(true);
      expect(predicate(queryWith(twoArg({ chainId: 999 }, { user: "0xabc" })))).toBe(true);
      expect(predicate(queryWith(twoArg({ chainId: 1 }, { user: "0xdef" })))).toBe(false);
    });

    it("ignores trailing segments beyond the partials provided", () => {
      const predicate = predicateMatch(twoArg, { chainId: 1 });
      expect(predicate(queryWith(twoArg({ chainId: 1 }, { user: "0xanything" })))).toBe(true);
    });
  });
});
