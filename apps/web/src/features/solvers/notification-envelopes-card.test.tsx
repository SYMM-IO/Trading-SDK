import { normalizeListingNotification } from "@symmio/trading-core";
import { useListingNotifications } from "@symmio/trading-react";
import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { NotificationEnvelopesCard } from "./notification-envelopes-card";

vi.mock("@symmio/trading-react", () => ({
  useListingNotifications: vi.fn(),
  useNotificationEnvelopes: () => ({ status: "open" }),
}));
vi.mock("./solver-target", () => ({
  SolverTargetSelect: () => null,
  useSolverTargetState: () => ({ target: { chainId: 42161, solverId: "enigma" } }),
}));
vi.mock("../inspector/subaccount-picker", () => ({ SubAccountPicker: () => null }));

it("shows the typed listing payload independently of the raw envelope log", () => {
  render(<NotificationEnvelopesCard />);
  const event = normalizeListingNotification({
    address: "owner",
    app_name: "listing",
    data: {
      details: {
        event: "insufficient_deposit",
        token_ticker: "MAD",
        minimum_required_amount_1e18: "12345678901234567890",
      },
    },
  });
  if (!event) throw new Error("Expected a normalized deposit event");
  const subscription = vi.mocked(useListingNotifications).mock.calls.at(0)?.[0];
  if (!subscription) throw new Error("Expected the listing subscription");
  act(() => subscription.onNotification(event));
  expect(screen.getByText("Latest listing event")).toBeTruthy();
  expect(JSON.parse(screen.getByText(/minimumRequiredAmount1e18/).textContent ?? "")).toMatchObject({
    kind: "insufficient_deposit",
    tokenTicker: "MAD",
    minimumRequiredAmount1e18: "12345678901234567890",
  });
  expect(screen.getByText("No envelopes received.")).toBeTruthy();
});
