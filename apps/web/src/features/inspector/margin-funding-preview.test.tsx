import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MarginFundingPreview } from "./margin-funding-preview";

const mocks = vi.hoisted(() => ({ funding: vi.fn(), supported: vi.fn(), refetch: vi.fn() }));
vi.mock("@symmio/trading-react", () => ({
  useGaslessMarginFunding: mocks.funding,
  useSupportsGaslessService: mocks.supported,
}));
const props = {
  parentAccount: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
  virtualAccount: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const,
  direction: "add" as const,
  amount18: 100n,
};
const shortfall = {
  hasSufficientBalance: false,
  isCovered: false,
  maxAddAmount18: 95n,
  payers: [
    {
      payer: props.parentAccount,
      debit18: 5n,
      projectedBalance18: 0n,
      shortfall18: 5n,
      allowanceDebit18: 5n,
      allowanceShortfall18: 0n,
      missing: ["balance"],
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.supported.mockReturnValue(true);
  mocks.funding.mockReturnValue({ data: undefined, isFetching: false, isError: false, refetch: mocks.refetch });
});
afterEach(cleanup);

it("only reads on explicit preview and warns that protected execution may differ", () => {
  render(<MarginFundingPreview {...props} />);
  expect(mocks.funding).toHaveBeenCalledWith(
    expect.objectContaining({ ...props, account: props.parentAccount, query: { enabled: false } }),
  );
  expect(mocks.refetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
  expect(mocks.refetch).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/protected execution may differ/i)).toBeTruthy();
});

it("shows the SDK shortfall and exact fee-safe Max without calculating them", () => {
  mocks.funding.mockReturnValue({ data: shortfall, isFetching: false, isError: false, refetch: mocks.refetch });
  render(<MarginFundingPreview {...props} />);
  expect(screen.queryByText(/Not covered/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
  expect(screen.getByText(/Not covered/)).toBeTruthy();
  expect(screen.queryByText(/Approve a larger fee allowance/)).toBeNull();
  expect(screen.getByText(/Fee-safe add bound: 0.000000000000000095/)).toBeTruthy();
});

it("hides cached funding when a refresh fails", () => {
  mocks.funding.mockReturnValue({
    data: shortfall,
    isFetching: false,
    isError: true,
    error: { kind: "api", code: "GASLESS_FREE_QUOTA_EXHAUSTED", message: "Quota exhausted" },
    refetch: mocks.refetch,
  });
  render(<MarginFundingPreview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
  expect(screen.getByText("Quota exhausted")).toBeTruthy();
  expect(screen.queryByText(/Fee-safe add bound/)).toBeNull();
});

it("hides cached funding while a refresh is pending", () => {
  mocks.funding.mockReturnValue({ data: shortfall, isFetching: true, isError: false, refetch: mocks.refetch });
  render(<MarginFundingPreview {...props} />);
  expect(screen.getByText("Reading fee funding…")).toBeTruthy();
  expect(screen.queryByText(/Fee-safe add bound/)).toBeNull();
});

it("hides the preview on an unsupported chain", () => {
  mocks.supported.mockReturnValue(false);
  const { container } = render(<MarginFundingPreview {...props} />);
  expect(container.innerHTML).toBe("");
  expect(mocks.refetch).not.toHaveBeenCalled();
});

it("tells an allowance shortfall apart from a balance shortfall", () => {
  const payer = { ...shortfall.payers[0]!, shortfall18: 0n, allowanceShortfall18: 5n, missing: ["allowance"] };
  mocks.funding.mockReturnValue({
    data: { ...shortfall, hasSufficientBalance: true, maxAddAmount18: null, payers: [payer] },
    isFetching: false,
    isError: false,
    refetch: mocks.refetch,
  });
  render(<MarginFundingPreview {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
  expect(screen.getByText(/Not covered/)).toBeTruthy();
  expect(screen.getByText(/Approve a larger fee allowance; a deposit does not fix it/)).toBeTruthy();
  expect(screen.queryByText(/Fee-safe add bound/)).toBeNull();
});
