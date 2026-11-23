import { expect, it } from "vitest";
import { normalizeListingNotification } from "./watch-listing-notifications";
it("projects a listing deposit and ignores unrelated documents", () => {
  const frame = {
    app_name: "listing",
    address: "0xowner",
    secondary_identifier: "market-1",
    data: { event: "deposit_received", id: "evt-listing-1" },
  };
  expect(normalizeListingNotification(frame)).toEqual({
    kind: "deposit_received",
    channel: "listing",
    account: "0xowner",
    marketId: "market-1",
    eventId: "evt-listing-1",
  });
  expect(normalizeListingNotification({ ...frame, data: { event: "other" } })).toBeUndefined();
});

it("preserves replay time and exact token amounts for an insufficient deposit toast", () => {
  expect(
    normalizeListingNotification({
      address: "owner",
      app_name: "listing",
      successful: false,
      data: {
        event: "insufficient_deposit",
        sent_time: "1720000000",
        chain_id: "42161",
        token_ticker: "MAD",
        deposited_amount_1e18: "12345678901234567890",
        minimum_required_amount_1e18: "25000000000000000000",
        listing_fee_amount_1e18: "0",
        token_contract_address: "token",
        deposit_amount_1e18: "1000000000000000000",
      },
    }),
  ).toMatchObject({
    kind: "insufficient_deposit",
    timestamp: 1720000000000,
    chainId: 42161,
    tokenTicker: "MAD",
    depositedAmount1e18: "12345678901234567890",
    minimumRequiredAmount1e18: "25000000000000000000",
    depositAmount1e18: "1000000000000000000",
    listingFeeAmount1e18: "0",
    successful: false,
    tokenContractAddress: "token",
  });
});

it.each([false, true])("reads a failure from nested details (JSON encoded: %s)", (encoded) => {
  const details = {
    notification_event: "pool_creation_failed",
    failure_message: "Pool rejected",
    error_code: "403",
    eventId: "retry-1",
    retry_count: 0,
    retry_limit: 3,
  };
  expect(
    normalizeListingNotification({
      address: "owner",
      app_name: "listing",
      data: { event: "generic", details: encoded ? JSON.stringify(details) : details },
    }),
  ).toMatchObject({
    kind: "pool_creation_failed",
    errorMessage: "Pool rejected",
    errorCode: 403,
    eventId: "retry-1",
    retryCount: 0,
    retryLimit: 3,
  });
});
