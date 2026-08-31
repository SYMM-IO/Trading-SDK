import { describe, expect, it } from "vitest";
import { toRetryListingResult } from "./to-retry-listing-result";

describe("toRetryListingResult", () => {
  it("maps the retry allowance fields", () => {
    expect(toRetryListingResult({ retry_limit: 3, remaining_retries: 1, cooldown_seconds: 3600 })).toEqual({
      retryLimit: 3,
      remainingRetries: 1,
      cooldownSeconds: 3600,
    });
  });
});
