import type { GetEstimatedPriceReturnType } from "@symmio/trading-core";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EnigmaEstimatedPriceCard } from "./enigma-estimated-price-card";

const mock = vi.hoisted(() => ({
  data: undefined as GetEstimatedPriceReturnType | undefined,
  isFetching: false,
  isDebouncing: false,
}));
vi.mock("@symmio/trading-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@symmio/trading-react")>()),
  useEstimatedPrice: () => ({ ...mock }),
}));
vi.mock("./solver-target", () => ({ useSolverKindActive: () => true }));
vi.mock("../inspector/method-card", () => ({
  MethodCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

beforeEach(() => {
  mock.data = { estimatedPrice: "110", estimatedPriceWithoutShadow: "100" };
  mock.isFetching = false;
  mock.isDebouncing = false;
});
afterEach(cleanup);

test("inspector shows the primary price, optional no-shadow price and their relative gap", () => {
  render(<EnigmaEstimatedPriceCard />);
  expect(screen.getByText("110")).toBeDefined();
  expect(screen.getByTestId("estimated-price-without-shadow").textContent).toBe("100");
  expect(screen.getByTestId("estimated-price-shadow-gap").textContent).toBe("+10%");
});

test("inspector groups the execution price and diagnostics in one result section", () => {
  render(<EnigmaEstimatedPriceCard />);
  const result = screen.getByRole("group", { name: "Estimated price result" });
  expect(result.contains(screen.getByText("110"))).toBe(true);
  expect(result.contains(screen.getByTestId("estimated-price-without-shadow"))).toBe(true);
  expect(result.contains(screen.getByTestId("estimated-price-shadow-gap"))).toBe(true);
});

test("inspector does not invent the optional price or gap for an older response", () => {
  mock.data = { estimatedPrice: "110" };
  render(<EnigmaEstimatedPriceCard />);
  expect(screen.getByText("110")).toBeDefined();
  expect(screen.getByTestId("estimated-price-without-shadow").textContent).toBe("Not provided by solver");
  expect(screen.getByTestId("estimated-price-shadow-gap").textContent).toBe("—");
});

test.each(["0", "not-a-price"])("inspector does not present an invalid denominator %s as a zero gap", (value) => {
  mock.data = { estimatedPrice: "110", estimatedPriceWithoutShadow: value };
  render(<EnigmaEstimatedPriceCard />);
  expect(screen.getByTestId("estimated-price-shadow-gap").textContent).toBe("—");
});

test.each(["isFetching", "isDebouncing"] as const)("inspector hides previous prices while %s", (state) => {
  mock[state] = true;
  render(<EnigmaEstimatedPriceCard />);
  expect(screen.queryByText("110")).toBeNull();
  expect(screen.queryByText("100")).toBeNull();
  expect(screen.queryByText("+10%")).toBeNull();
});
