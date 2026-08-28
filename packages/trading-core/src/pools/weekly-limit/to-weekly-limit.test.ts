import { describe, expect, it } from "vitest";
import { toWeeklyListingLimit } from "./to-weekly-limit";

describe("toWeeklyListingLimit", () => {
  it("maps { limit, remaining, reset_at } into { limit, remaining, resetAt }", () => {
    expect(toWeeklyListingLimit({ limit: 5, remaining: 2, reset_at: 1735689600 })).toEqual({
      limit: 5,
      remaining: 2,
      resetAt: 1735689600,
    });
  });
});
