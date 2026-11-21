import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GaslessBatchFunding } from "./gasless-batch-funding";

const mocks = vi.hoisted(() => ({ funding: vi.fn(), supported: vi.fn(), refetch: vi.fn() }));
vi.mock("@symmio/trading-react", () => ({
  useGaslessBatchFunding: mocks.funding,
  useSupportsGaslessService: mocks.supported,
}));

const account = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const va = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const calls = [{ functionName: "addMargin", args: [va, 50n] }] as const;
const payment = {
  account,
  payer: account,
  source: 0,
  operationalFee18: 3n * 10n ** 16n,
  depositFee18: 0n,
  walletCreationFee18: 2n * 10n ** 16n,
  nativeTopUpFee18: 0n,
  nativeGasCollateral18: 0n,
};
const otherPayment = { ...payment, payer: va, walletCreationFee18: 0n };
const quote = { payments: [payment, otherPayment] };
const shortfall = {
  hasSufficientBalance: false,
  quote,
  payers: [
    {
      payer: account,
      debit18: 5n * 10n ** 16n,
      balanceBefore18: 50n * 10n ** 18n,
      projectedBalance18: 0n,
      shortfall18: 5n * 10n ** 16n,
      allowanceDebit18: 5n * 10n ** 16n,
      allowance18: 2n ** 256n - 1n,
      allowanceShortfall18: 0n,
      missing: ["balance"],
    },
  ],
};
const covered = {
  hasSufficientBalance: true,
  quote,
  payers: [{ ...shortfall.payers[0]!, projectedBalance18: 10n ** 18n, shortfall18: 0n, missing: [] }],
};
const allowanceShort = {
  hasSufficientBalance: true,
  quote,
  payers: [
    { ...covered.payers[0]!, allowance18: 10n ** 16n, allowanceShortfall18: 4n * 10n ** 16n, missing: ["allowance"] },
  ],
};

function lastParameters() {
  return mocks.funding.mock.lastCall?.[0] as { balanceChanges: unknown[]; query: unknown };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supported.mockReturnValue(true);
  mocks.funding.mockReturnValue({ data: undefined, isFetching: false, isError: false, refetch: mocks.refetch });
});
afterEach(cleanup);

it("waits for a complete batch before offering the check", () => {
  const { container } = render(<GaslessBatchFunding account={account} />);
  expect(container.innerHTML).toBe("");
  expect(mocks.funding).not.toHaveBeenCalled();
});

it("reads only on an explicit check, never on mount", () => {
  render(<GaslessBatchFunding account={account} calls={calls} />);
  expect(mocks.funding).toHaveBeenCalledWith(
    expect.objectContaining({ account, calls, balanceChanges: [], query: { enabled: false } }),
  );
  expect(mocks.refetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(mocks.refetch).toHaveBeenCalledOnce();
});

it("passes typed balance changes as signed 18-decimal movements", () => {
  render(<GaslessBatchFunding account={account} calls={calls} />);
  expect(screen.queryByRole("button", { name: "Add row" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Balance changes/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add row" }));
  expect(screen.getByLabelText("Balance change 1 account")).toHaveProperty("value", account);
  fireEvent.change(screen.getByLabelText("Balance change 1 amount"), { target: { value: "-50" } });
  fireEvent.click(screen.getByRole("button", { name: "Add row" }));
  fireEvent.change(screen.getByLabelText("Balance change 2 account"), { target: { value: va } });
  fireEvent.change(screen.getByLabelText("Balance change 2 amount"), { target: { value: "+50.5" } });
  expect(lastParameters().balanceChanges).toEqual([
    { account, delta18: -50n * 10n ** 18n },
    { account: va, delta18: 505n * 10n ** 17n },
  ]);
  expect(screen.getByRole("button", { name: /Balance changes \(2\)/ })).toBeTruthy();
});

it("blocks the check while a balance change cannot be read", () => {
  render(<GaslessBatchFunding account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: /Balance changes/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add row" }));
  fireEvent.change(screen.getByLabelText("Balance change 1 amount"), { target: { value: "fifty" } });
  expect(screen.getByTestId("gasless-batch-funding-invalid")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Check funding" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Remove balance change 1" }));
  expect(screen.getByRole("button", { name: "Check funding" })).toHaveProperty("disabled", false);
});

it("shows a not-covered verdict and opens that payer's breakdown by itself", () => {
  mocks.funding.mockReturnValue({ data: shortfall, isFetching: false, isError: false, refetch: mocks.refetch });
  render(<GaslessBatchFunding account={account} calls={calls} labels={["addMargin", "editAccountName"]} />);
  expect(screen.queryByTestId("gasless-batch-funding-verdict")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(screen.getByTestId("gasless-batch-funding-verdict").textContent).toBe("⚠ not covered");
  expect(screen.getByRole("button", { name: /Total charged 0.05 USDC · 1 payer/ }).getAttribute("aria-expanded")).toBe(
    "true",
  );
  const payers = screen.getByTestId("gasless-batch-funding-payers").textContent;
  // Only this payer's charges, named after their operation; the other payer's call is not listed.
  expect(payers).toContain("addMargin · operational fee0.03 USDC");
  expect(payers).toContain("Wallet creation · addMargin0.02 USDC");
  expect(payers).not.toContain("editAccountName");
  expect(payers).toContain("Balance now50 USDC");
  expect(payers).toContain("Missing balance0.05 USDC");
  fireEvent.click(screen.getByRole("button", { name: "Recheck" }));
  expect(mocks.refetch).toHaveBeenCalledTimes(2);
});

it("marks a covered batch as covered", () => {
  mocks.funding.mockReturnValue({ data: covered, isFetching: false, isError: false, refetch: mocks.refetch });
  render(<GaslessBatchFunding account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(screen.getByTestId("gasless-batch-funding-verdict").textContent).toBe("✓ covered");
  expect(screen.queryByTestId("gasless-batch-funding-payers")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Details/ }));
  const payers = screen.getByTestId("gasless-batch-funding-payers").textContent;
  // Without a card label the operation falls back to its position.
  expect(payers).toContain("Operation 1 · operational fee0.03 USDC");
  expect(payers).not.toContain("Missing balance");
  fireEvent.click(screen.getByRole("button", { name: /Hide details/ }));
  expect(screen.queryByTestId("gasless-batch-funding-payers")).toBeNull();
});

it("replaces old data with the error when a refresh fails", () => {
  mocks.funding.mockReturnValue({
    data: shortfall,
    isFetching: false,
    isError: true,
    error: { kind: "api", code: "GASLESS_FREE_QUOTA_EXHAUSTED", message: "Quota exhausted" },
    refetch: mocks.refetch,
  });
  render(<GaslessBatchFunding account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(screen.getByText("check unavailable")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  expect(screen.queryByTestId("gasless-batch-funding-payers")).toBeNull();
});

it("hides old data while a refresh is pending", () => {
  mocks.funding.mockReturnValue({ data: shortfall, isFetching: true, isError: false, refetch: mocks.refetch });
  render(<GaslessBatchFunding account={account} calls={calls} />);
  expect(screen.getByText("checking…")).toBeTruthy();
  expect(screen.queryByTestId("gasless-batch-funding-payers")).toBeNull();
});

it("renders nothing on a chain without the gasless service", () => {
  mocks.supported.mockReturnValue(false);
  const { container } = render(<GaslessBatchFunding account={account} calls={calls} />);
  expect(container.innerHTML).toBe("");
});

it("hides the answer and blocks a new read while the batch is being relayed", () => {
  mocks.funding.mockReturnValue({ data: covered, isFetching: false, isError: false, refetch: mocks.refetch });
  const { rerender } = render(<GaslessBatchFunding account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(screen.getByTestId("gasless-batch-funding-verdict")).toBeTruthy();
  rerender(<GaslessBatchFunding account={account} calls={calls} writePending />);
  expect(screen.queryByTestId("gasless-batch-funding-verdict")).toBeNull();
  const check = screen.getByRole("button", { name: "Check funding" });
  expect(check).toHaveProperty("disabled", true);
  fireEvent.click(check);
  expect(mocks.refetch).toHaveBeenCalledOnce();
});

it("hides an earlier answer after a relay but keeps the typed balance changes", () => {
  mocks.funding.mockReturnValue({ data: covered, isFetching: false, isError: false, refetch: mocks.refetch });
  const { rerender } = render(<GaslessBatchFunding resetKey="0:idle" account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: /Balance changes/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add row" }));
  fireEvent.change(screen.getByLabelText("Balance change 1 amount"), { target: { value: "-50" } });
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(screen.getByTestId("gasless-batch-funding-verdict")).toBeTruthy();
  // The batch card passes its relay's submittedAt and status as the reset key.
  rerender(<GaslessBatchFunding resetKey="1700000000000:success" account={account} calls={calls} />);
  expect(screen.queryByTestId("gasless-batch-funding-verdict")).toBeNull();
  expect(screen.getByLabelText("Balance change 1 amount")).toHaveProperty("value", "-50");
  // Checking again under the new key reads fresh and shows the answer.
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(mocks.refetch).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("gasless-batch-funding-verdict")).toBeTruthy();
});

it("treats a new row as not filled in until an amount is typed", () => {
  render(<GaslessBatchFunding account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: /Balance changes/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add row" }));
  expect(screen.queryByTestId("gasless-batch-funding-invalid")).toBeNull();
  expect(screen.getByRole("button", { name: "Check funding" })).toHaveProperty("disabled", false);
  expect(lastParameters().balanceChanges).toEqual([]);
});

it("names the reason when the batch's fees come from wallet collateral", () => {
  mocks.funding.mockReturnValue({
    data: undefined,
    isFetching: false,
    isError: true,
    error: {
      kind: "validation",
      code: "GASLESS_FUNDING_SOURCE_UNSUPPORTED",
      message: "Funding projections require SYMMIO account fee sources.",
    },
    refetch: mocks.refetch,
  });
  render(<GaslessBatchFunding account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(screen.getByTestId("gasless-batch-funding-failed").textContent).toBe("not supported for wallet-call fees");
});

it("shows a missing fee allowance as its own reason, apart from the balance", () => {
  mocks.funding.mockReturnValue({ data: allowanceShort, isFetching: false, isError: false, refetch: mocks.refetch });
  render(<GaslessBatchFunding account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  expect(screen.getByTestId("gasless-batch-funding-verdict").textContent).toBe("⚠ not covered");
  const payers = screen.getByTestId("gasless-batch-funding-payers").textContent;
  expect(payers).toContain("Fee allowance0.01 USDC");
  expect(payers).toContain("Missing allowance0.04 USDC");
  expect(payers).not.toContain("Missing balance");
});

it("shows an unlimited allowance as unlimited, not as digits", () => {
  mocks.funding.mockReturnValue({ data: covered, isFetching: false, isError: false, refetch: mocks.refetch });
  render(<GaslessBatchFunding account={account} calls={calls} />);
  fireEvent.click(screen.getByRole("button", { name: "Check funding" }));
  fireEvent.click(screen.getByRole("button", { name: /Details/ }));
  expect(screen.getByTestId("gasless-batch-funding-payers").textContent).toContain("Fee allowanceunlimited");
});
