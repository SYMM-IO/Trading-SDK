import { useTpSlRecord, useTpSlStore, type TpSlNotification } from "@symmio/trading-react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TpSlConfirmationStatus } from "./tp-sl-confirmation-status";

const quoteId = -123n;
const confirmingWindowMs = 90_000;
function Status({ tp = true, sl = false }: { tp?: boolean; sl?: boolean }) {
  const record = useTpSlRecord(quoteId);
  return <TpSlConfirmationStatus idPrefix="test" record={record} tp={tp} sl={sl} />;
}
function report(side: "take_profit" | "stop_loss", state: TpSlNotification["state"] = "new") {
  const notification: TpSlNotification = {
    quoteId: Number(quoteId),
    primaryIdentifier: 0,
    secondaryIdentifier: Number(quoteId),
    account: "0x0000000000000000000000000000000000000002",
    conditionalOrderType: side,
    state,
    successful: true,
    cohQuoteId: "coh123",
    raw: {},
  };
  act(() => useTpSlStore.getState().applyNotification(quoteId, notification));
}
beforeEach(() => {
  vi.useFakeTimers();
  useTpSlStore.setState({ records: new Map(), index: new Map() });
});
afterEach(() => {
  cleanup();
  useTpSlStore.setState({ records: new Map(), index: new Map() });
  vi.useRealTimers();
});

test.each(["tp", "sl"] as const)("accepted %s stays loading until its SDK notification arrives", (side) => {
  useTpSlStore.getState().markConfirming(quoteId, side, { price: "12" });
  render(<Status tp={side === "tp"} sl={side === "sl"} />);
  expect(screen.getByTestId("test-status").textContent).toContain("Setting TP/SL");
  expect(screen.queryByTestId("test-success")).toBeNull();
  report(side === "tp" ? "take_profit" : "stop_loss");
  expect(screen.getByTestId("test-success").textContent).toBe("TP/SL active");
});

test("both submitted sides must confirm; a partial success keeps loading", () => {
  const store = useTpSlStore.getState();
  store.markConfirming(quoteId, "tp");
  store.markConfirming(quoteId, "sl");
  render(<Status tp sl />);
  report("take_profit");
  expect(screen.queryByTestId("test-success")).toBeNull();
  expect(screen.getByTestId("test-status")).toBeDefined();
  report("stop_loss", "edit");
  expect(screen.getByTestId("test-success")).toBeDefined();
});

test("cancellation of a submitted side is an error even when the other side confirmed", () => {
  const store = useTpSlStore.getState();
  store.markConfirming(quoteId, "tp");
  store.markConfirming(quoteId, "sl");
  render(<Status tp sl />);
  report("take_profit");
  report("stop_loss", "canceled");
  expect(screen.getByRole("alert").textContent).toContain("activation failed");
  expect(screen.queryByTestId("test-success")).toBeNull();
  act(() => vi.advanceTimersByTime(confirmingWindowMs));
  expect(screen.getByRole("alert").textContent).toContain("activation failed");
  expect(screen.queryByTestId("test-unconfirmed")).toBeNull();
});

test("a killed submitted side is an error", () => {
  useTpSlStore.getState().markConfirming(quoteId, "tp");
  const record = useTpSlStore.getState().get(quoteId)!;
  render(<TpSlConfirmationStatus idPrefix="test" record={{ ...record, tpState: "killed" }} tp sl={false} />);
  expect(screen.getByRole("alert").textContent).toContain("activation failed");
});

test("90 seconds without a report produces a warning, never success, failure or retry", () => {
  useTpSlStore.getState().markConfirming(quoteId, "tp");
  render(<Status />);
  act(() => vi.advanceTimersByTime(confirmingWindowMs - 1));
  expect(screen.getByTestId("test-status")).toBeDefined();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId("test-unconfirmed").textContent).toContain("check current orders");
  expect(screen.queryByTestId("test-success")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  // The expired SDK guard may fold an empty REST read to canceled. This is
  // still an unconfirmed submission, not a definitive failure notification.
  act(() => useTpSlStore.getState().setRows(quoteId, []));
  expect(screen.getByTestId("test-unconfirmed")).toBeDefined();
  report("take_profit");
  expect(screen.getByTestId("test-success")).toBeDefined();
});

test("a missing initial snapshot waits, then warns", () => {
  render(<Status />);
  expect(screen.getByTestId("test-status")).toBeDefined();
  act(() => vi.advanceTimersByTime(confirmingWindowMs));
  expect(screen.getByTestId("test-unconfirmed")).toBeDefined();
});

test("a new submission resets the deadline and unmount cleans up its timer", () => {
  useTpSlStore.getState().markConfirming(quoteId, "tp");
  const { rerender, unmount } = render(<Status key="first" />);
  act(() => vi.advanceTimersByTime(confirmingWindowMs));
  expect(screen.getByTestId("test-unconfirmed")).toBeDefined();
  act(() => useTpSlStore.getState().markConfirming(quoteId, "tp"));
  rerender(<Status key="second" />);
  expect(screen.getByTestId("test-status")).toBeDefined();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
