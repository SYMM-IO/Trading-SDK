import { describe, expect, it } from "vitest";
import { createExpressConfig, TEST_ACCOUNT, TEST_AMOUNT, TEST_RECEIVER } from "../test-fixtures";
import { getExpressWithdrawOptionsQueryOptions } from "./query";

const PARAMETERS = { user: TEST_ACCOUNT, amount: TEST_AMOUNT, receiver: TEST_RECEIVER } as const;

describe("getExpressWithdrawOptionsQueryOptions", () => {
  it("disables automatic retries and focus/reconnect refetches by default", () => {
    const options = getExpressWithdrawOptionsQueryOptions(createExpressConfig(), PARAMETERS);

    expect(options.queryKey[0]).toBe("getExpressWithdrawOptions");
    expect(options.retry).toBe(false);
    expect(options.refetchOnWindowFocus).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);
  });

  it("lets explicit query overrides win", () => {
    const options = getExpressWithdrawOptionsQueryOptions(createExpressConfig(), {
      ...PARAMETERS,
      query: { retry: 2, refetchOnWindowFocus: true, refetchOnReconnect: "always", enabled: false },
    });

    expect(options).toMatchObject({
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: "always",
      enabled: false,
    });
  });

  it("keeps the abort signal and query overrides out of the key", () => {
    const options = getExpressWithdrawOptionsQueryOptions(createExpressConfig(), {
      ...PARAMETERS,
      signal: new AbortController().signal,
      query: { retry: 2 },
    });

    expect(options.queryKey[1]).not.toHaveProperty("signal");
    expect(options.queryKey[1]).not.toHaveProperty("query");
  });
});
