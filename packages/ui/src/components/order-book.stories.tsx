import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { OrderBook, type OrderBookDisplay, type OrderBookRowData } from "./order-book";

/**
 * A deterministic book around a mid, thinning as it moves away from the touch —
 * the shape a real ladder has, so the depth bars read the way they would live.
 */
function buildSide(bestPrice: number, direction: -1 | 1, tick: number, rows: number): OrderBookRowData[] {
  let total = 0;
  return Array.from({ length: rows }, (_, index) => {
    const size = Number((0.4 + ((index * 7) % 11) * 0.31).toFixed(3));
    total = Number((total + size).toFixed(3));
    return { price: Number((bestPrice + direction * tick * index).toFixed(1)), size, total };
  });
}

const BIDS = buildSide(63_018.1, -1, 0.1, 15);
const ASKS = buildSide(63_018.3, 1, 0.1, 15);

const SPREAD = {
  bestBid: 63_018.1,
  bestAsk: 63_018.3,
  spread: 0.2,
  spreadBps: 0.317,
  midPrice: 63_018.2,
};

const meta = {
  title: "UI/OrderBook",
  component: OrderBook,
  parameters: { layout: "centered" },
  args: {
    bids: BIDS,
    asks: ASKS,
    spread: SPREAD,
    baseAsset: "BTC",
    quoteAsset: "USDT",
    pricePrecision: 1,
    sizePrecision: 3,
    status: "live",
    className: "w-80",
  },
  argTypes: {
    display: { control: { type: "select" }, options: ["both", "bids", "asks"] },
    status: { control: { type: "select" }, options: ["idle", "loading", "live", "stale", "error"] },
  },
} satisfies Meta<typeof OrderBook>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithImbalance: Story = {
  args: { imbalance: 0.34 },
};

export const AskHeavy: Story = {
  args: {
    imbalance: -0.52,
    bids: BIDS.map((row) => ({ ...row, size: row.size / 4, total: row.total / 4 })),
  },
};

export const BidsOnly: Story = { args: { display: "bids" } };
export const AsksOnly: Story = { args: { display: "asks" } };

export const Loading: Story = { args: { status: "loading", bids: [], asks: [], spread: undefined } };

export const Resyncing: Story = {
  args: { status: "stale", imbalance: 0.1 },
};

export const Failed: Story = {
  args: {
    status: "error",
    errorMessage: "The depth stream dropped and could not be re-established.",
  },
};

export const Empty: Story = {
  args: { status: "idle", bids: [], asks: [], spread: undefined },
};

/** A thin side must read as thin, not be stretched to fill its own column. */
export const OneSidedDepth: Story = {
  args: {
    asks: ASKS.map((row) => ({ ...row, size: row.size / 12, total: row.total / 12 })),
  },
};

/** Short sides are padded, so the seam holds still instead of sliding. */
export const PaddedRows: Story = {
  args: { bids: BIDS.slice(0, 4), asks: ASKS.slice(0, 2), rows: 15 },
};

/** Every control wired up, which is how the web demo consumes it. */
export const Interactive: Story = {
  render: function InteractiveOrderBook(args) {
    const [display, setDisplay] = React.useState<OrderBookDisplay>("both");
    const [tickSize, setTickSize] = React.useState(0.1);
    const [picked, setPicked] = React.useState<string>();

    return (
      <div className="flex w-80 flex-col gap-3">
        <OrderBook
          {...args}
          display={display}
          onDisplayChange={setDisplay}
          tickSize={tickSize}
          tickSizeOptions={[0.1, 0.2, 0.5, 1, 2, 5]}
          onTickSizeChange={setTickSize}
          imbalance={0.18}
          onSelectLevel={(level) => setPicked(`${level.side} ${level.price} × ${level.size}`)}
        />
        <p className="text-muted-foreground font-mono text-xs">{picked ?? "Select a level to prefill an order."}</p>
      </div>
    );
  },
};

/** Sizes shift on a timer so the change highlight and bar transitions are visible. */
export const Streaming: Story = {
  render: function StreamingOrderBook(args) {
    const [tick, setTick] = React.useState(0);

    React.useEffect(() => {
      const timer = setInterval(() => setTick((previous) => previous + 1), 900);
      return () => clearInterval(timer);
    }, []);

    const jitter = React.useCallback(
      (rows: OrderBookRowData[], seed: number) => {
        let total = 0;
        return rows.map((row, index) => {
          const size = Number((row.size * (0.55 + (((index + tick + seed) * 13) % 17) / 17)).toFixed(3));
          total = Number((total + size).toFixed(3));
          return { ...row, size, total };
        });
      },
      [tick],
    );

    return (
      <OrderBook
        {...args}
        bids={jitter(BIDS, 0)}
        asks={jitter(ASKS, 5)}
        imbalance={Math.sin(tick / 3) * 0.5}
        onSelectLevel={() => {}}
      />
    );
  },
};
