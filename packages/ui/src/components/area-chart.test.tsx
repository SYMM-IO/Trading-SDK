import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AreaChart, type AreaChartPoint } from "./area-chart";

afterEach(cleanup);

const DAY = 86_400_000;
const POINTS: AreaChartPoint[] = Array.from({ length: 10 }, (_, index) => ({
  x: index * DAY,
  y: 100 + index * 25,
}));

function renderChart(points = POINTS) {
  return render(
    <AreaChart
      points={points}
      label="TVL"
      width={400}
      height={200}
      formatValue={(value) => `$${value}`}
      formatX={(x) => `d${x / DAY}`}
      testId="chart"
    />,
  );
}

describe("AreaChart", () => {
  it("draws the line, the wash, and labels only the endpoint", () => {
    const { container } = renderChart();

    expect(container.querySelector('[data-slot="area-chart-line"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="area-chart-fill"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="area-chart-end"]')?.textContent).toBe("$325");
    /** No value on every point — the axis and the tooltip carry the rest. */
    expect(container.textContent).not.toContain("$125");
  });

  it("names the series for assistive tech and renders nothing without data", () => {
    renderChart();
    expect(screen.getByRole("img", { name: "TVL" })).toBeTruthy();

    cleanup();
    const { container } = renderChart([]);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("walks the series from the keyboard and reads the value at the crosshair", () => {
    renderChart();
    const svg = screen.getByTestId("chart-svg");

    fireEvent.focus(svg);
    expect(screen.getByTestId("chart-tooltip").textContent).toContain("$325");

    fireEvent.keyDown(svg, { key: "ArrowLeft" });
    expect(screen.getByTestId("chart-tooltip").textContent).toContain("$300");

    fireEvent.keyDown(svg, { key: "Home" });
    expect(screen.getByTestId("chart-tooltip").textContent).toContain("$100");
    expect(screen.getByTestId("chart-tooltip").textContent).toContain("d0");

    fireEvent.keyDown(svg, { key: "Escape" });
    expect(screen.queryByTestId("chart-tooltip")).toBeNull();
  });
});
