import { describe, expect, it } from "vitest";
import {
  compactWhere,
  hasEmptyListFilter,
  lowercaseList,
  resolveSubgraphPage,
  stringList,
  SUBGRAPH_MAX_PAGE_SIZE,
  toSubgraphPage,
} from "./subgraph-filters";

describe("compactWhere", () => {
  it("drops undefined filters so graph-node never receives a null filter", () => {
    expect(compactWhere({ a: 1, b: undefined, c: [], d: null })).toEqual({ a: 1, c: [], d: null });
  });
});

describe("hasEmptyListFilter", () => {
  it("is true only when a passed list is empty", () => {
    expect(hasEmptyListFilter(undefined, ["x"])).toBe(false);
    expect(hasEmptyListFilter(undefined, [])).toBe(true);
    expect(hasEmptyListFilter()).toBe(false);
  });
});

describe("resolveSubgraphPage", () => {
  it("applies the defaults", () => {
    expect(resolveSubgraphPage({})).toEqual({
      first: SUBGRAPH_MAX_PAGE_SIZE,
      skip: 0,
      orderBy: "timestamp",
      orderDirection: "desc",
    });
  });

  it("rejects a page size outside 1–1000 and a negative or fractional skip", () => {
    expect(() => resolveSubgraphPage({ first: 1001 })).toThrow(/first must be/);
    expect(() => resolveSubgraphPage({ first: 1.5 })).toThrow(/first must be/);
    expect(() => resolveSubgraphPage({ skip: -1 })).toThrow(/skip must be/);
  });

  it("sorts by id ascending when an idGt cursor is passed without a sort", () => {
    expect(resolveSubgraphPage({ idGt: "cursor-1" })).toEqual({
      first: SUBGRAPH_MAX_PAGE_SIZE,
      skip: 0,
      orderBy: "id",
      orderDirection: "asc",
    });
    expect(resolveSubgraphPage({ idGt: "cursor-1", orderBy: "id", orderDirection: "asc" })).toMatchObject({
      orderBy: "id",
      orderDirection: "asc",
    });
  });

  it.each([
    ["the timestamp sort", { orderBy: "timestamp" }],
    ["a descending id sort", { orderBy: "id", orderDirection: "desc" }],
    ["a descending direction alone", { orderDirection: "desc" }],
    ["a timestamp sort with an ascending direction", { orderBy: "timestamp", orderDirection: "asc" }],
  ] as const)("rejects an idGt cursor with %s, which would drop or repeat rows", (_label, sort) => {
    let error: unknown;
    try {
      resolveSubgraphPage({ idGt: "cursor-1", ...sort });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ kind: "validation", code: "INVALID_SUBGRAPH_CURSOR" });
  });
});

describe("toSubgraphPage", () => {
  it("reports hasMore only for a full page", () => {
    expect(toSubgraphPage([1, 2], 2)).toEqual({ rows: [1, 2], hasMore: true });
    expect(toSubgraphPage([1], 2)).toEqual({ rows: [1], hasMore: false });
  });
});

describe("list helpers", () => {
  it("lowercase addresses and stringify ids, passing undefined through", () => {
    expect(lowercaseList(["0xABC"])).toEqual(["0xabc"]);
    expect(lowercaseList(undefined)).toBeUndefined();
    expect(stringList([7334n, 149])).toEqual(["7334", "149"]);
    expect(stringList(undefined)).toBeUndefined();
  });
});
