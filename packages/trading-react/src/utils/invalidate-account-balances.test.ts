import {
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getInstantClosesQueryKey,
} from "@symmio/trading-core";
import type { Query, QueryKey } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../test/test-utils";
import { invalidateAccountBalances } from "./invalidate-account-balances";

const CONFIG_KEY = "config-key-a";
const OTHER_CONFIG_KEY = "config-key-b";
const ACCOUNT = "0x1111111111111111111111111111111111111111";
const OTHER_ACCOUNT = "0x2222222222222222222222222222222222222222";

/** The predicates only read `query.queryKey`, so a minimal stub cast to `Query` is enough. */
function queryWith(key: QueryKey): Query<unknown, Error, unknown, QueryKey> {
  return { queryKey: key } as Query<unknown, Error, unknown, QueryKey>;
}

/** Structural view of the `invalidateQueries` spy — only the recorded arguments matter here. */
interface InvalidateSpy {
  mock: { calls: readonly (readonly unknown[])[] };
}

/** Run every predicate the helper handed to `invalidateQueries` against one key. */
function matchesAny(invalidate: InvalidateSpy, key: QueryKey): boolean {
  return invalidate.mock.calls.some((call) => {
    const { predicate } = call[0] as { predicate: (q: Query) => boolean };
    return predicate(queryWith(key));
  });
}

describe("invalidateAccountBalances", () => {
  it("invalidates both balanceOf and balanceInfo for the given config", () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    invalidateAccountBalances(queryClient, { configKey: CONFIG_KEY });

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(matchesAny(invalidate, getAccountBalanceOfQueryKey({ configKey: CONFIG_KEY, account: ACCOUNT }))).toBe(true);
    expect(matchesAny(invalidate, getAccountBalanceInfoQueryKey({ configKey: CONFIG_KEY, account: ACCOUNT }))).toBe(
      true,
    );
  });

  it("matches every account on the config — a write can move both a VA and its parent subaccount", () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    invalidateAccountBalances(queryClient, { configKey: CONFIG_KEY });

    expect(matchesAny(invalidate, getAccountBalanceOfQueryKey({ configKey: CONFIG_KEY, account: ACCOUNT }))).toBe(true);
    expect(matchesAny(invalidate, getAccountBalanceOfQueryKey({ configKey: CONFIG_KEY, account: OTHER_ACCOUNT }))).toBe(
      true,
    );
  });

  it("leaves balances on another chain config alone", () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    invalidateAccountBalances(queryClient, { configKey: CONFIG_KEY });

    expect(matchesAny(invalidate, getAccountBalanceOfQueryKey({ configKey: OTHER_CONFIG_KEY, account: ACCOUNT }))).toBe(
      false,
    );
  });

  it("leaves unrelated query tags alone", () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    invalidateAccountBalances(queryClient, { configKey: CONFIG_KEY });

    expect(matchesAny(invalidate, getInstantClosesQueryKey({ configKey: CONFIG_KEY }))).toBe(false);
  });
});
