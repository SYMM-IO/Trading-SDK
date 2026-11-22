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
