import type { Candle } from "@symmio/trading-core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LogicalRange, LogicalRangeChangeEventHandler } from "lightweight-charts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CandleChart } from "./candle-chart";

const mocks = vi.hoisted(() => ({ createChart: vi.fn() }));
vi.mock("lightweight-charts", () => ({
  createChart: mocks.createChart,
  CandlestickSeries: "candles",
  HistogramSeries: "volume",
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
}));

const START = Date.UTC(2026, 10, 1);

function bars(from: number, to: number): Candle[] {
  return Array.from({ length: to - from }, (_, index) => ({
    time: START + (from + index) * 60_000,
    open: 1,
    high: 2,
    low: 1,
    close: 2,
    volume: 10,
  }));
}

describe("candle chart history navigation", () => {
  let data: { time: number }[];
  let visible: LogicalRange | null;
  let onRange: LogicalRangeChangeEventHandler | undefined;
  const fitContent = vi.fn();
  const setVisibleLogicalRange = vi.fn();
  const unsubscribe = vi.fn();

  function moveRange(from: number, to: number) {
    visible = { from, to } as LogicalRange;
    act(() => onRange?.(visible));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    data = [];
    visible = null;
    onRange = undefined;
    fitContent.mockReset().mockImplementation(() => {
      visible = { from: 0, to: data.length - 1 } as LogicalRange;
      onRange?.(visible);
    });
    setVisibleLogicalRange.mockReset().mockImplementation((range: LogicalRange) => {
      visible = range;
      onRange?.(visible);
    });
    unsubscribe.mockReset();
    const candleSeries = {
      data: () => data,
      setData: vi.fn((next: { time: number }[]) => {
        data = next;
      }),
      update: vi.fn(),
      applyOptions: vi.fn(),
    };
    const volumeSeries = { setData: vi.fn(), update: vi.fn() };
    const timeScale = {
      fitContent,
      setVisibleLogicalRange,
      getVisibleLogicalRange: () => visible,
      timeToIndex: (time: number, nearest = false) => {
        const index = data.findIndex((bar) => (nearest ? bar.time >= time : bar.time === time));
        return index === -1 ? null : index;
      },
      subscribeVisibleLogicalRangeChange: (handler: LogicalRangeChangeEventHandler) => {
        onRange = handler;
      },
      unsubscribeVisibleLogicalRangeChange: unsubscribe,
    };
    mocks.createChart.mockReset().mockReturnValue({
      addSeries: (kind: string) => (kind === "candles" ? candleSeries : volumeSeries),
      priceScale: () => ({ applyOptions: vi.fn() }),
      timeScale: () => timeScale,
      applyOptions: vi.fn(),
      remove: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("loads only when a user gesture moves toward the left edge", () => {
    const loadOlder = vi.fn();
    render(<CandleChart candles={bars(0, 300)} onLoadOlder={loadOlder} />);
    moveRange(-10, 200);
    expect(loadOlder).not.toHaveBeenCalled();

    moveRange(80, 180);
    fireEvent.pointerDown(screen.getByTestId("candle-chart"), { button: 0, isPrimary: true, clientX: 100 });
    moveRange(90, 190);
    expect(loadOlder).not.toHaveBeenCalled();
    moveRange(49, 149);
    expect(loadOlder).toHaveBeenCalledTimes(1);
    moveRange(-10, 90);
    expect(loadOlder).toHaveBeenCalledTimes(1);
  });

  it("loads after zooming out and disarms before a data update can request again", () => {
    const loadOlder = vi.fn();
    const view = render(<CandleChart candles={bars(0, 300)} onLoadOlder={loadOlder} />);
    fireEvent.wheel(screen.getByTestId("candle-chart"), { deltaY: 120 });
    moveRange(-30, 330);
    expect(loadOlder).toHaveBeenCalledTimes(1);

    view.rerender(<CandleChart candles={bars(0, 300)} onLoadOlder={loadOlder} />);
    moveRange(-60, 360);
    act(() => vi.runAllTimers());
    expect(loadOlder).toHaveBeenCalledTimes(1);
    fireEvent.wheel(screen.getByTestId("candle-chart"), { deltaY: 120 });
    moveRange(-90, 390);
    expect(loadOlder).toHaveBeenCalledTimes(2);
  });

  it("lets a rightward drag or zoom-out continue past an entirely empty window", () => {
    const loadOlder = vi.fn();
    render(<CandleChart candles={[]} onLoadOlder={loadOlder} emptyLabel="No candles" />);
    const chart = screen.getByTestId("candle-chart");
    fireEvent.pointerDown(chart, { button: 0, isPrimary: true, clientX: 100 });
    fireEvent.pointerMove(chart, { clientX: 140 });
    fireEvent.pointerMove(chart, { clientX: 180 });
    fireEvent.pointerUp(window);
    expect(loadOlder).toHaveBeenCalledTimes(1);

    fireEvent.wheel(chart, { deltaY: 120 });
    expect(loadOlder).toHaveBeenCalledTimes(2);
    act(() => vi.runAllTimers());
    expect(loadOlder).toHaveBeenCalledTimes(2);
  });

  it("keeps the same candles and zoom in view when older bars are prepended", () => {
    const view = render(<CandleChart candles={bars(100, 200)} onLoadOlder={vi.fn()} />);
    moveRange(30.25, 60.75);
    view.rerender(<CandleChart candles={bars(50, 200)} onLoadOlder={vi.fn()} />);
    expect(setVisibleLogicalRange).toHaveBeenLastCalledWith({ from: 80.25, to: 110.75 });
    expect(fitContent).toHaveBeenCalledTimes(1);

    view.rerender(<CandleChart candles={bars(50, 210)} onLoadOlder={vi.fn()} />);
    expect(setVisibleLogicalRange).toHaveBeenLastCalledWith({ from: 80.25, to: 110.75 });
    expect(fitContent).toHaveBeenCalledTimes(1);
  });

  it("keeps fitting changed history in charts without automatic history navigation", () => {
    const view = render(<CandleChart candles={bars(100, 200)} />);
    view.rerender(<CandleChart candles={bars(50, 200)} />);
    expect(fitContent).toHaveBeenCalledTimes(2);
    expect(setVisibleLogicalRange).not.toHaveBeenCalled();
  });

  it("preserves the live candle after prepending history without overwriting a refreshed snapshot", () => {
    const recent = bars(100, 200);
    const live = bars(200, 201)[0]!;
    const view = render(<CandleChart candles={recent} liveCandle={live} onLoadOlder={vi.fn()} />);
    const series = mocks.createChart.mock.results[0]?.value.addSeries("candles");
    expect(series.update).toHaveBeenCalledOnce();
    view.rerender(<CandleChart candles={[...bars(50, 100), ...recent]} liveCandle={live} onLoadOlder={vi.fn()} />);
    expect(series.update).toHaveBeenCalledTimes(2);
    view.rerender(<CandleChart candles={bars(50, 201)} liveCandle={live} onLoadOlder={vi.fn()} />);
    expect(series.update).toHaveBeenCalledTimes(2);
  });

  it("removes gesture listeners and pending wheel work on unmount", () => {
    const loadOlder = vi.fn();
    const view = render(<CandleChart candles={bars(0, 300)} onLoadOlder={loadOlder} />);
    const chart = screen.getByTestId("candle-chart");
    fireEvent.wheel(chart, { deltaY: 120 });
    view.unmount();
    moveRange(-30, 330);
    fireEvent.wheel(chart, { deltaY: 120 });
    act(() => vi.runAllTimers());
    expect(loadOlder).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledWith(onRange);
  });

  it("ignores a restarted stream's older seed after a newer live candle was drawn", () => {
    const history = bars(0, 100);
    const live = bars(100, 101)[0]!;
    const view = render(<CandleChart candles={history} liveCandle={live} />);
    const series = mocks.createChart.mock.results[0]?.value.addSeries("candles");
    series.update.mockClear();
    view.rerender(<CandleChart candles={history} liveCandle={null} />);
    view.rerender(<CandleChart candles={history} liveCandle={{ ...history.at(-1)!, close: 3 }} />);
    expect(series.update).not.toHaveBeenCalled();
    view.rerender(<CandleChart candles={history} liveCandle={{ ...live, close: 3 }} />);
    expect(series.update).toHaveBeenCalledOnce();
  });

  it("keeps a newer live interval when refreshed history still ends in the previous interval", () => {
    const live = bars(100, 101)[0]!;
    const view = render(<CandleChart candles={bars(0, 100)} liveCandle={live} />);
    const series = mocks.createChart.mock.results[0]?.value.addSeries("candles");
    series.update.mockClear();
    view.rerender(<CandleChart candles={bars(0, 100)} liveCandle={live} />);
    expect(series.update).toHaveBeenCalledOnce();
    expect(series.update.mock.lastCall?.[0].time).toBe(live.time / 1000);
  });
});
