import type { Meta, StoryObj } from "@storybook/react";
import { BarChart, type BarChartBucket, type BarChartSeries } from "./bar-chart";

const DAY = 86_400_000;
const START = Date.UTC(2026, 6, 1);

/** Daily rewards for `series` pools: bursty, with some genuinely empty days. */
function buildBuckets(days: number, series: number): BarChartBucket[] {
  return Array.from({ length: days }, (_, index) => ({
    x: START + index * DAY,
    values: Array.from({ length: series }, (_, s) => {
      const pulse = (Math.sin(index / (2 + s)) + 1) * 18 * (1 - s * 0.18);
      return index % 7 === 6 - s ? 0 : Number(pulse.toFixed(2));
    }),
  }));
}

const SINGLE: BarChartSeries[] = [{ id: "pool", label: "Pool rewards", tone: 1 }];
const STACKED: BarChartSeries[] = [
  { id: "symm", label: "SYMM · Base", tone: 1 },
  { id: "pepe", label: "PEPE · BSC", tone: 2 },
  { id: "wif", label: "WIF · Solana", tone: 3 },
  { id: "bonk", label: "BONK · Solana", tone: 4 },
  { id: "other", label: "Other pools", tone: "muted" },
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const full = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const meta = {
  title: "UI/BarChart",
  component: BarChart,
  parameters: { layout: "padded" },
  args: {
    series: SINGLE,
    buckets: buildBuckets(30, 1),
    label: "Daily rewards",
    formatValue: (value: number) => usd.format(value),
    formatX: (x: number) => day.format(x),
    formatXDetail: (x: number) => full.format(x),
    height: 240,
  },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One series: plain bars, the peak directly labeled, no legend. */
export const Single: Story = {};

/** Several series stack from the baseline with a surface gap between segments, and a legend names them. */
export const Stacked: Story = {
  args: { series: STACKED, buckets: buildBuckets(30, STACKED.length) },
};

/** Few buckets: bars cap at 24px and the band's leftover is air. */
export const Sparse: Story = {
  args: { buckets: buildBuckets(5, 1), width: 480 },
};

/** Many buckets: bars shrink to keep the 2px gap, and the axis labels thin out. */
export const Dense: Story = {
  args: { buckets: buildBuckets(120, 1), width: 640 },
};
