import { describe, expect, it } from "vitest";
import { ListingMarketStatus } from "../types";
import type { MarketListingStatusResponse } from "../types/generated/listing-backend";
import { toListingStatus } from "./to-listing-status";

describe("toListingStatus", () => {
  it("maps the wire fields to the normalized ListingStatus", () => {
    const raw: MarketListingStatusResponse = {
      current_step: "review",
      steps: ["deposit", "review", "listed"],
      market_status: "listed",
      error_code: 0,
      error_detail: "ok",
      retry_count: 2,
      retry_limit: 5,
    };

    expect(toListingStatus(raw)).toEqual({
      marketStatus: ListingMarketStatus.LISTED,
      currentStep: "review",
      steps: ["deposit", "review", "listed"],
      errorCode: 0,
      errorDetail: "ok",
      retryCount: 2,
      retryLimit: 5,
    });
  });

  it("defaults absent optionals — null step and error, zero retries", () => {
    const raw = { market_status: "waiting_for_deposit", steps: [] } as MarketListingStatusResponse;

    expect(toListingStatus(raw)).toEqual({
      marketStatus: ListingMarketStatus.WAITING_FOR_DEPOSIT,
      currentStep: null,
      steps: [],
      errorCode: null,
      errorDetail: null,
      retryCount: 0,
      retryLimit: 0,
    });
  });
});
