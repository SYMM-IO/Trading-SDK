import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarChart, type BarChartBucket, type BarChartSeries } from "./bar-chart";

afterEach(cleanup);

const DAY = 86_400_000;
const ONE: BarChartSeries[] = [{ id: "pool", label: "Pool", tone: 1 }];
const TWO: BarChartSeries[] = [
  { id: "a", label: "Pool A", tone: 1 },
  { id: "b", label: "Pool B", tone: 2 },
];
const BUCKETS: BarChartBucket[] = [
  { x: 0, values: [10, 5] },
  { x: DAY, values: [0, 8] },
  { x: 2 * DAY, values: [30, 0] },
];

function renderChart(series: BarChartSeries[]) {
  return render(
    <BarChart
      series={series}
      buckets={BUCKETS}
      label="Rewards"
      width={400}
      height={200}
      formatValue={(value) => `$${value}`}
      formatX={(x) => `d${x / DAY}`}
      testId="chart"
    />,
  );
}

describe("BarChart", () => {
  it("draws one bar per bucket, labels only the peak, and shows no legend for a single series", () => {
    const { container } = renderChart(ONE);

    expect(container.querySelectorAll('[data-slot="bar-chart-bar"]')).toHaveLength(3);
    expect(container.querySelector('[data-slot="bar-chart-peak"]')?.textContent).toBe("$30");
    expect(container.querySelector('[data-slot="chart-legend"]')).toBeNull();
  });

  it("stacks several series with a legend, and skips empty segments without leaving a gap", () => {
    const { container } = renderChart(TWO);

    expect(container.querySelector('[data-slot="chart-legend"]')?.textContent).toContain("Pool B");
    expect(container.querySelector('[data-slot="bar-chart-peak"]')).toBeNull();

    const bars = container.querySelectorAll('[data-slot="bar-chart-bar"]');
    /** Day 0 paints both segments; day 1 and day 2 each paint exactly one. */
    expect(bars[0]?.children).toHaveLength(2);
    expect(bars[1]?.children).toHaveLength(1);
    expect(bars[2]?.children).toHaveLength(1);
  });

  it("lists every series in one tooltip and lifts the hovered bar", () => {
    const { container } = renderChart(TWO);
    const hits = container.querySelectorAll('[data-slot="bar-chart-hit"]');

    fireEvent.pointerMove(hits[1]!);
    const tooltip = screen.getByTestId("chart-tooltip").textContent ?? "";
    expect(tooltip).toContain("d1");
    expect(tooltip).toContain("$0");
    expect(tooltip).toContain("$8");
    expect(tooltip).toContain("Pool A");

    const bars = container.querySelectorAll<HTMLElement>('[data-slot="bar-chart-bar"]');
    expect(bars[1]?.style.filter).toContain("brightness");
    expect(bars[0]?.style.filter).toBe("");
  });

  it("walks the buckets from the keyboard", () => {
    renderChart(ONE);
    const svg = screen.getByTestId("chart-svg");

    fireEvent.focus(svg);
    expect(screen.getByTestId("chart-tooltip").textContent).toContain("$30");
    fireEvent.keyDown(svg, { key: "Home" });
    expect(screen.getByTestId("chart-tooltip").textContent).toContain("$10");
  });
});
