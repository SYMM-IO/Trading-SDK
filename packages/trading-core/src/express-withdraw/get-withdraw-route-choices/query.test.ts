import { describe, expect, it } from "vitest";
import { createExpressConfig, TEST_ACCOUNT, TEST_AMOUNT, TEST_RECEIVER } from "../test-fixtures";
import { getWithdrawRouteChoicesQueryOptions } from "./query";

const PARAMETERS = { user: TEST_ACCOUNT, amount: TEST_AMOUNT, receiver: TEST_RECEIVER } as const;

describe("getWithdrawRouteChoicesQueryOptions", () => {
  it("disables automatic retries and focus/reconnect refetches by default", () => {
    const options = getWithdrawRouteChoicesQueryOptions(createExpressConfig(), PARAMETERS);

    expect(options.queryKey[0]).toBe("getWithdrawRouteChoices");
    expect(options.retry).toBe(false);
    expect(options.refetchOnWindowFocus).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);
  });

  it("lets explicit query overrides win", () => {
    const options = getWithdrawRouteChoicesQueryOptions(createExpressConfig(), {
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
});
