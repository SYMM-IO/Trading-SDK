import type { Meta, StoryObj } from "@storybook/react";
import { AreaChart, type AreaChartPoint } from "./area-chart";

const DAY = 86_400_000;
const START = Date.UTC(2026, 5, 1);

/** A deterministic TVL curve: a ramp, a drawdown, and a recovery, so the wash and endpoint read the way they would live. */
function buildSeries(days: number): AreaChartPoint[] {
  return Array.from({ length: days }, (_, index) => {
    const wave = Math.sin(index / 6) * 900 + Math.sin(index / 2.3) * 220;
    return { x: START + index * DAY, y: Math.max(0, 4_200 + index * 85 + wave) };
  });
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const full = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const meta = {
  title: "UI/AreaChart",
  component: AreaChart,
  parameters: { layout: "padded" },
  args: {
    points: buildSeries(60),
    label: "TVL",
    formatValue: (value: number) => usd.format(value),
    formatX: (x: number) => day.format(x),
    formatXDetail: (x: number) => full.format(x),
    height: 240,
  },
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Measures its container — resize the canvas and the axis re-picks how many labels fit. */
export const Default: Story = {};

export const FixedWidth: Story = {
  args: { width: 520 },
};

/** Two points: the smallest series that still draws a line, an endpoint, and both labels. */
export const TwoPoints: Story = {
  args: { points: buildSeries(2), width: 360 },
};

/** A flat zero series still draws an axis rather than an empty box. */
export const AllZero: Story = {
  args: { points: buildSeries(14).map((point) => ({ ...point, y: 0 })), width: 480 },
};
