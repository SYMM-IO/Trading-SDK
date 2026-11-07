import { PositionType } from "@symmio/trading-core";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EstimatedPricePreview } from "./estimated-price-preview";

const mock = vi.hoisted(() => ({ isFetching: false, isDebouncing: false }));
vi.mock("@symmio/trading-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@symmio/trading-react")>()),
  supportsEstimatedPrice: () => true,
  useSymmioConfig: () => ({}),
  useEstimatedPrice: () => ({
    data: { estimatedPrice: "110", estimatedPriceWithoutShadow: "25" },
    ...mock,
  }),
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

test("preview does not display a previous-input estimate while debouncing", () => {
  mock.isDebouncing = true;
  render(<EstimatedPricePreview {...props} entry="open" />);
  expect(screen.getByTestId("trade-estimated-price").textContent).not.toContain("110.00");
});
