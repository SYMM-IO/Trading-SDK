import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderBook, type OrderBookProps, type OrderBookRowData } from "./order-book";

afterEach(cleanup);

function side(bestPrice: number, direction: -1 | 1, sizes: number[]): OrderBookRowData[] {
  let total = 0;
  return sizes.map((size, index) => {
    total = Number((total + size).toFixed(6));
    return { price: Number((bestPrice + direction * index).toFixed(6)), size, total };
  });
}

const BIDS = side(99, -1, [1, 2, 3]);
const ASKS = side(101, 1, [1, 1, 2]);

const SPREAD = { bestBid: 99, bestAsk: 101, spread: 2, spreadBps: 200, midPrice: 100 };

function renderBook(overrides: Partial<OrderBookProps> = {}) {
  return render(
    <OrderBook bids={BIDS} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} {...overrides} />,
  );
}

function depthScale(element: HTMLElement): number {
  const bar = element.querySelector<HTMLElement>('[data-slot="order-book-depth"]');
  const match = /scaleX\(([\d.]+)\)/.exec(bar?.style.transform ?? "");
  return match ? Number(match[1]) : Number.NaN;
}

describe("OrderBook — structure", () => {
  it("renders every level on both sides", () => {
    renderBook();

    expect(within(screen.getByTestId("order-book-bids")).getAllByRole("row")).toHaveLength(3);
    expect(within(screen.getByTestId("order-book-asks")).getAllByRole("row")).toHaveLength(3);
  });

  it("places the best ask closest to the seam", () => {
    renderBook();

    const askRows = within(screen.getByTestId("order-book-asks")).getAllByRole("row");
    /** Asks read outward from the seam, so the last rendered row is the touch. */
    expect(askRows.at(-1)).toBe(screen.getByTestId("order-book-ask-0"));
    expect(askRows.at(-1)?.textContent).toContain("101.00");
  });

  it("places the best bid closest to the seam", () => {
    renderBook();

    const bidRows = within(screen.getByTestId("order-book-bids")).getAllByRole("row");
    expect(bidRows[0]).toBe(screen.getByTestId("order-book-bid-0"));
    expect(bidRows[0]?.textContent).toContain("99.00");
  });

  it("formats price, size and total at the requested precision", () => {
    renderBook({ pricePrecision: 1, sizePrecision: 3 });

    const row = screen.getByTestId("order-book-bid-1");
    expect(row?.textContent).toContain("98.0");
    expect(row?.textContent).toContain("2.000");
    /** Total is cumulative and inclusive: 1 + 2. */
    expect(row?.textContent).toContain("3.000");
  });

  it("labels the columns with the market's assets", () => {
    renderBook({ baseAsset: "BTC", quoteAsset: "USDT" });

    expect(screen.getByText("Price (USDT)")).toBeDefined();
    expect(screen.getByText("Size (BTC)")).toBeDefined();
  });
});

describe("OrderBook — depth bars", () => {
  it("scales each side against its own depth by default, so both sides show their shape", () => {
    renderBook();

    /**
     * Bids reach 6 and asks 4. Per-side, each side's deepest row fills the bar,
     * so a lopsided book still shows where each side's walls sit.
     */
    expect(depthScale(screen.getByTestId("order-book-bid-2"))).toBeCloseTo(1, 6);
    expect(depthScale(screen.getByTestId("order-book-ask-2"))).toBeCloseTo(1, 6);
    expect(depthScale(screen.getByTestId("order-book-ask-0"))).toBeCloseTo(1 / 4, 6);
  });

  it("scales both sides against the deeper one when asked to", () => {
    renderBook({ scale: "shared" });

    expect(depthScale(screen.getByTestId("order-book-bid-2"))).toBeCloseTo(1, 6);
    expect(depthScale(screen.getByTestId("order-book-ask-2"))).toBeCloseTo(4 / 6, 6);
  });

  it("keeps a side with no depth from dividing by zero", () => {
    renderBook({ asks: [], spread: undefined });

    expect(depthScale(screen.getByTestId("order-book-bid-0"))).toBeGreaterThan(0);
  });

  it("honours an explicit maxTotal over both scaling modes", () => {
    renderBook({ maxTotal: 12, scale: "per-side" });

    expect(depthScale(screen.getByTestId("order-book-bid-2"))).toBeCloseTo(0.5, 6);
  });

  it("gives the touch level a bar, since totals are inclusive", () => {
    renderBook();

    expect(depthScale(screen.getByTestId("order-book-bid-0"))).toBeGreaterThan(0);
  });

  it("clamps a total that overshoots the scale", () => {
    renderBook({ maxTotal: 1 });

    expect(depthScale(screen.getByTestId("order-book-bid-2"))).toBe(1);
  });

  it("draws no bar when there is no depth to scale against", () => {
    renderBook({ bids: [{ price: 99, size: 0, total: 0 }], asks: [], spread: undefined });

    expect(depthScale(screen.getByTestId("order-book-bid-0"))).toBe(0);
  });
});

describe("OrderBook — the seam", () => {
  it("shows the mid, the absolute spread and the spread in basis points", () => {
    renderBook();

    const seam = screen.getByTestId("order-book-seam");
    expect(screen.getByTestId("order-book-mid")?.textContent).toContain("100.00");
    expect(seam?.textContent).toContain("2.00");
    expect(seam?.textContent).toContain("200 bps");
  });

  it("says so rather than inventing a mid when the book is one-sided", () => {
    renderBook({ spread: undefined });

    expect(screen.getByTestId("order-book-seam")?.textContent).toContain("Spread unavailable");
  });

  it("hides the imbalance rail when no imbalance is supplied", () => {
    renderBook();

    expect(screen.queryByTestId("order-book-imbalance")).toBeNull();
  });

  it("splits the rail toward bids on a positive imbalance", () => {
    renderBook({ imbalance: 0.5 });

    const rail = screen.getByTestId("order-book-imbalance");
    expect((rail.firstElementChild as HTMLElement).style.flexBasis).toBe("75%");
    expect(rail.getAttribute("aria-label")).toContain("bids");
  });

  it("splits the rail toward asks on a negative imbalance", () => {
    renderBook({ imbalance: -0.5 });

    const rail = screen.getByTestId("order-book-imbalance");
    expect((rail.firstElementChild as HTMLElement).style.flexBasis).toBe("25%");
    expect(rail.getAttribute("aria-label")).toContain("asks");
  });

  it("keeps a sliver visible at the extremes rather than collapsing a side", () => {
    renderBook({ imbalance: -1 });

    expect((screen.getByTestId("order-book-imbalance").firstElementChild as HTMLElement).style.flexBasis).toBe("4%");
  });
});

describe("OrderBook — row padding", () => {
  it("pads short sides so the seam holds still", () => {
    const { container } = renderBook({ bids: BIDS.slice(0, 1), asks: ASKS.slice(0, 2), rows: 6 });

    expect(container.querySelectorAll('[data-slot="order-book-row"][data-empty="true"]')).toHaveLength(9);
  });

  it("keeps blanks out of the accessibility tree", () => {
    renderBook({ bids: BIDS.slice(0, 1), asks: [], rows: 5 });

    expect(within(screen.getByTestId("order-book-bids")).getAllByRole("row")).toHaveLength(1);
  });

  it("truncates a side that is longer than the row budget", () => {
    renderBook({ rows: 2 });

    expect(within(screen.getByTestId("order-book-bids")).getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByTestId("order-book-bid-2")).toBeNull();
  });
});

describe("OrderBook — selection", () => {
  it("reports the clicked level with its side", () => {
    const onSelectLevel = vi.fn();
    renderBook({ onSelectLevel });

    fireEvent.click(screen.getByTestId("order-book-ask-1"));

    expect(onSelectLevel).toHaveBeenCalledWith({ price: 102, size: 1, total: 2, side: "ask" });
  });

  it("activates a row from the keyboard", () => {
    const onSelectLevel = vi.fn();
    renderBook({ onSelectLevel });

    const row = screen.getByTestId("order-book-bid-0");
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(onSelectLevel).toHaveBeenCalledTimes(2);
    expect(onSelectLevel).toHaveBeenLastCalledWith(expect.objectContaining({ price: 99, side: "bid" }));
  });

  it("ignores keys that are not activation keys", () => {
    const onSelectLevel = vi.fn();
    renderBook({ onSelectLevel });

    fireEvent.keyDown(screen.getByTestId("order-book-bid-0"), { key: "a" });

    expect(onSelectLevel).not.toHaveBeenCalled();
  });

  it("leaves rows inert and out of the tab order when no handler is given", () => {
    renderBook();

    const row = screen.getByTestId("order-book-bid-0");
    expect(row.getAttribute("role")).toBe("row");
    expect(row.getAttribute("tabindex")).toBeNull();
  });

  it("makes rows focusable buttons when a handler is given", () => {
    renderBook({ onSelectLevel: vi.fn() });

    const row = screen.getByTestId("order-book-bid-0");
    expect(row.getAttribute("role")).toBe("button");
    expect(row.getAttribute("tabindex")).toBe("0");
  });

  it("describes each level for assistive technology", () => {
    renderBook({ onSelectLevel: vi.fn() });

    expect(screen.getByTestId("order-book-ask-0").getAttribute("aria-label")).toBe("Ask 101.00, size 1.00");
  });
});

describe("OrderBook — controls", () => {
  it("hides the side toggle unless a handler is given", () => {
    renderBook();

    expect(screen.queryByTestId("order-book-display-both")).toBeNull();
  });

  it("reports the chosen side mode", () => {
    const onDisplayChange = vi.fn();
    renderBook({ onDisplayChange });

    fireEvent.click(screen.getByTestId("order-book-display-asks"));

    expect(onDisplayChange).toHaveBeenCalledWith("asks");
  });

  it("marks the active side mode as pressed", () => {
    renderBook({ display: "bids", onDisplayChange: vi.fn() });

    expect(screen.getByTestId("order-book-display-bids").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("order-book-display-both").getAttribute("aria-pressed")).toBe("false");
  });

  it("renders only the bid side in bids mode", () => {
    renderBook({ display: "bids" });

    expect(screen.getByTestId("order-book-bids")).toBeDefined();
    expect(screen.queryByTestId("order-book-asks")).toBeNull();
    /** The seam stays: it still carries the mid and the spread. */
    expect(screen.getByTestId("order-book-seam")).toBeDefined();
  });

  it("renders only the ask side in asks mode", () => {
    renderBook({ display: "asks" });

    expect(screen.getByTestId("order-book-asks")).toBeDefined();
    expect(screen.queryByTestId("order-book-bids")).toBeNull();
  });

  it("hides the grouping selector without options or a handler", () => {
    renderBook({ tickSizeOptions: [0.1, 1] });

    expect(screen.queryByTestId("order-book-tick-size")).toBeNull();
  });

  it("shows the grouping selector when both options and a handler are given", () => {
    renderBook({ tickSize: 0.1, tickSizeOptions: [0.1, 1], onTickSizeChange: vi.fn() });

    expect(screen.getByTestId("order-book-tick-size")).toBeDefined();
  });
});

describe("OrderBook — feed states", () => {
  it("shows a spinner while loading an empty book", () => {
    renderBook({ status: "loading", bids: [], asks: [] });

    expect(screen.getByText("Loading depth…")).toBeDefined();
    expect(screen.queryByTestId("order-book-ladder")).toBeNull();
  });

  it("keeps showing the ladder while loading a book it already has", () => {
    renderBook({ status: "loading" });

    expect(screen.getByTestId("order-book-ladder")).toBeDefined();
  });

  it("dims rather than blanks the ladder during a rebuild", () => {
    renderBook({ status: "stale" });

    const ladder = screen.getByTestId("order-book-ladder");
    expect(ladder.className).toContain("opacity-60");
    expect(within(screen.getByTestId("order-book-bids")).getAllByRole("row")).toHaveLength(3);
  });

  it("replaces the ladder with an alert on error", () => {
    renderBook({ status: "error", errorMessage: "The depth stream dropped." });

    expect(screen.getByRole("alert")?.textContent).toContain("The depth stream dropped.");
    expect(screen.queryByTestId("order-book-ladder")).toBeNull();
  });

  it("falls back to a generic message when none is supplied", () => {
    renderBook({ status: "error" });

    expect(screen.getByRole("alert")?.textContent).toContain("The order book feed failed.");
  });

  it("shows an empty state when both sides are empty", () => {
    renderBook({ bids: [], asks: [], spread: undefined });

    expect(screen.getByTestId("order-book-empty")?.textContent).toContain("No resting orders.");
  });

  it("announces the feed state to assistive technology", () => {
    renderBook({ status: "stale" });

    expect(screen.getByTestId("order-book-status")?.textContent).toContain("Resyncing");
  });
});

describe("OrderBook — change highlighting", () => {
  it("does not flash on first paint", () => {
    const { container } = renderBook();

    expect(container.querySelectorAll('[data-slot="order-book-flash"]')).toHaveLength(0);
  });

  it("ignores a move too small to be worth the eye", () => {
    const { container, rerender } = render(
      <OrderBook bids={BIDS} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />,
    );

    /** A live book rewrites several times a second, mostly with dust like this. */
    const nudged = [{ ...BIDS[0]!, size: 1.02, total: 1.02 }, ...BIDS.slice(1)];
    rerender(<OrderBook bids={nudged} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />);

    expect(container.querySelectorAll('[data-slot="order-book-flash"]')).toHaveLength(0);
  });

  it("marks a level that is cleared, however small it was", () => {
    const { container, rerender } = render(
      <OrderBook bids={BIDS} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />,
    );

    const cleared = [{ ...BIDS[0]!, size: 0, total: 0 }, ...BIDS.slice(1)];
    rerender(<OrderBook bids={cleared} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />);

    expect(container.querySelectorAll('[data-slot="order-book-flash"]')).toHaveLength(1);
  });

  it("flashes up when a level grows and down when it shrinks", () => {
    const { container, rerender } = render(
      <OrderBook bids={BIDS} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />,
    );

    const grown = [{ ...BIDS[0]!, size: 5, total: 5 }, ...BIDS.slice(1)];
    rerender(<OrderBook bids={grown} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />);
    expect(container.querySelector('[data-slot="order-book-flash"]')?.getAttribute("data-direction")).toBe("up");

    const shrunk = [{ ...BIDS[0]!, size: 0.5, total: 0.5 }, ...BIDS.slice(1)];
    rerender(<OrderBook bids={shrunk} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />);
    expect(container.querySelector('[data-slot="order-book-flash"]')?.getAttribute("data-direction")).toBe("down");
  });

  it("does not flash a level whose size is unchanged", () => {
    const { container, rerender } = render(
      <OrderBook bids={BIDS} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />,
    );

    rerender(<OrderBook bids={[...BIDS]} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} />);

    expect(container.querySelectorAll('[data-slot="order-book-flash"]')).toHaveLength(0);
  });

  it("does not flash the whole ladder when the grouping changes", () => {
    const { container, rerender } = render(
      <OrderBook bids={BIDS} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} tickSize={1} />,
    );

    /** Regrouping renames every level; comparing across it would light up every row. */
    const regrouped = side(98, -1, [6, 4, 2]);
    rerender(
      <OrderBook bids={regrouped} asks={ASKS} spread={SPREAD} pricePrecision={2} sizePrecision={2} tickSize={5} />,
    );

    expect(container.querySelectorAll('[data-slot="order-book-flash"]')).toHaveLength(0);
  });

  it("can be turned off", () => {
    const { container, rerender } = render(
      <OrderBook
        bids={BIDS}
        asks={ASKS}
        spread={SPREAD}
        pricePrecision={2}
        sizePrecision={2}
        highlightChanges={false}
      />,
    );

    const grown = [{ ...BIDS[0]!, size: 9, total: 9 }, ...BIDS.slice(1)];
    rerender(
      <OrderBook
        bids={grown}
        asks={ASKS}
        spread={SPREAD}
        pricePrecision={2}
        sizePrecision={2}
        highlightChanges={false}
      />,
    );

    expect(container.querySelectorAll('[data-slot="order-book-flash"]')).toHaveLength(0);
  });
});

describe("OrderBook — customization", () => {
  it("uses a custom title and test-id prefix", () => {
    render(<OrderBook bids={BIDS} asks={ASKS} title="Depth" testId="depth" />);

    expect(screen.getByText("Depth")).toBeDefined();
    expect(screen.getByTestId("depth-bids")).toBeDefined();
  });

  it("merges a caller className onto the panel", () => {
    renderBook({ className: "w-96" });

    expect(screen.getByTestId("order-book").className).toContain("w-96");
  });

  it("forwards unknown props to the panel element", () => {
    renderBook({ id: "book-panel" });

    expect(screen.getByTestId("order-book").getAttribute("id")).toBe("book-panel");
  });
});
