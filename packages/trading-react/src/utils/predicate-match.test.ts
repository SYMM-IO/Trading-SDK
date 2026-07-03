import { getMarketsQueryKey, getUserSubAccountsQueryKey } from "@symmio/trading-core";
import type { Query, QueryKey } from "@tanstack/react-query";
import { hyperEvm, mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { predicateMatch } from "./predicate-match";

const USER = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

/**
 * `predicateMatch` only reads `query.queryKey`, so a minimal stub cast to
 * `Query` is enough.
 */
function queryWith(key: QueryKey): Query<unknown, Error, unknown, QueryKey> {
  return { queryKey: key } as Query<unknown, Error, unknown, QueryKey>;
}

describe("predicateMatch", () => {
  it("matches any query with the same tag when no partial is given", () => {
    const predicate = predicateMatch(getUserSubAccountsQueryKey);
    expect(predicate(queryWith(getUserSubAccountsQueryKey({ user: USER, chainId: hyperEvm.id })))).toBe(true);
  });

  it("rejects a query produced by a different key factory", () => {
    const predicate = predicateMatch(getUserSubAccountsQueryKey);
    expect(predicate(queryWith(getMarketsQueryKey({ chainId: hyperEvm.id })))).toBe(false);
  });

  it("matches by a field subset, ignoring pagination and chain", () => {
    const predicate = predicateMatch(getUserSubAccountsQueryKey, { user: USER });
    expect(
      predicate(queryWith(getUserSubAccountsQueryKey({ user: USER, chainId: hyperEvm.id, offset: 0n, limit: 200n }))),
    ).toBe(true);
    expect(predicate(queryWith(getUserSubAccountsQueryKey({ user: USER, chainId: mainnet.id, offset: 5n })))).toBe(
      true,
    );
  });

  it("rejects when a partial field differs", () => {
    const predicate = predicateMatch(getUserSubAccountsQueryKey, { user: USER });
    expect(predicate(queryWith(getUserSubAccountsQueryKey({ user: OTHER, chainId: hyperEvm.id })))).toBe(false);
  });

  it("rejects when the trailing segment is not a plain object", () => {
    const predicate = predicateMatch(getUserSubAccountsQueryKey, { user: USER });
    expect(predicate(queryWith(["getUserSubAccounts", "not-an-object"]))).toBe(false);
  });
});
