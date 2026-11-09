import { PositionType } from "@symmio/trading-core";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EstimatedPricePreview } from "./estimated-price-preview";

const mock = vi.hoisted(() => ({ isFetching: false, isDebouncing: false, estimate: vi.fn() }));
vi.mock("@symmio/trading-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@symmio/trading-react")>()),
  supportsEstimatedPrice: () => true,
  useSymmioConfig: () => ({}),
  useEstimatedPrice: (parameters: unknown) => {
    mock.estimate(parameters);
    return {
      data: { estimatedPrice: "110", estimatedPriceWithoutShadow: "25" },
      isFetching: mock.isFetching,
      isDebouncing: mock.isDebouncing,
    };
  },
}));
vi.mock("@symmio/ui/components/tooltip", () => {
  function Wrapper({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  return { Tooltip: Wrapper, TooltipTrigger: Wrapper, TooltipContent: Wrapper };
});

beforeEach(() => {
  mock.isFetching = false;
  mock.isDebouncing = false;
  mock.estimate.mockClear();
});
afterEach(cleanup);

const props = {
  symbolId: 1,
  quantity: "2",
  positionType: PositionType.LONG,
  requestPrice: "120",
  markPrice: "100",
  pricePrecision: 2,
  idPrefix: "trade",
} as const;

test.each(["open", "close"] as const)(
  "%s preview derives the displayed price and impact only from the primary estimate",
  (entry) => {
    render(<EstimatedPricePreview {...props} entry={entry} />);
    const text = screen.getByTestId("trade-estimated-price").textContent;
    expect(text).toContain("110.00");
    expect(text).toContain("+10%");
    expect(text).not.toContain("25");
  },
);

test("open preview displays the preparation hook's paired prices without another estimate request", () => {
  mock.isFetching = true;
  render(
    <EstimatedPricePreview {...props} entry="open" preparedEstimate={{ price: "105", priceWithoutShadow: "104" }} />,
  );
  const text = screen.getByTestId("trade-estimated-price").textContent;
  expect(text).toContain("105.00");
  expect(text).toContain("+5%");
  expect(text).not.toContain("110.00");
  expect(screen.getByTestId("trade-estimated-price-without-shadow").textContent).toContain("104");
  expect(mock.estimate.mock.lastCall?.[0].query.enabled).toBe(false);
});

test.each([undefined, null])("prepared estimate %s does not fall back to another query's cached price", (price) => {
  render(<EstimatedPricePreview {...props} entry="open" preparedEstimate={{ price, priceWithoutShadow: "104" }} />);
  expect(screen.getByTestId("trade-estimated-price").textContent).not.toContain("110.00");
  expect(screen.queryByTestId("trade-estimated-price-without-shadow")).toBeNull();
});

test("prepared no-shadow value disappears when the hook clears it", () => {
  const view = render(
    <EstimatedPricePreview {...props} entry="open" preparedEstimate={{ price: "105", priceWithoutShadow: "104" }} />,
  );
  expect(screen.getByTestId("trade-estimated-price-without-shadow")).toBeDefined();
  view.rerender(<EstimatedPricePreview {...props} entry="open" preparedEstimate={{ price: "105" }} />);
  expect(screen.queryByTestId("trade-estimated-price-without-shadow")).toBeNull();
  expect(screen.getByTestId("trade-estimated-price").textContent).toContain("105.00");
});

test("preview does not display a previous-input estimate while debouncing", () => {
  mock.isDebouncing = true;
  render(<EstimatedPricePreview {...props} entry="open" />);
  expect(screen.getByTestId("trade-estimated-price").textContent).not.toContain("110.00");
});
