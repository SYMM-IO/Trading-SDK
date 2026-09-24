import { describe, expect, it } from "vitest";
import { toRetryListingInfo } from "./to-retry-listing-info";

describe("toRetryListingInfo", () => {
  it("maps the fields, defaulting an absent cooldown to null", () => {
    expect(toRetryListingInfo({ retry_limit: 3, remaining_retries: 2 })).toEqual({
      retryLimit: 3,
      remainingRetries: 2,
      remainingCooldownSeconds: null,
    });
  });

  it("carries a present cooldown through", () => {
    expect(
      toRetryListingInfo({ retry_limit: 3, remaining_retries: 1, remaining_cooldown_seconds: 600 })
        .remainingCooldownSeconds,
    ).toBe(600);
  });
});
