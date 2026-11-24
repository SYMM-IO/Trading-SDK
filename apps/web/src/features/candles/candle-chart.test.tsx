import type { Candle, CandleHistoryPage } from "@symmio/trading-core";
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
  let data: { time: number; close: number }[];
  let volumeData: { time: number; value: number }[];
  let visible: LogicalRange | null;
  let onRange: LogicalRangeChangeEventHandler | undefined;
  const fitContent = vi.fn();
  const setVisibleLogicalRange = vi.fn();
  const unsubscribe = vi.fn();
  const applyVolumeOptions = vi.fn();

  function moveRange(from: number, to: number) {
    visible = { from, to } as LogicalRange;
    act(() => onRange?.(visible));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    data = [];
    volumeData = [];
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
    applyVolumeOptions.mockReset();
    const candleSeries = {
      data: () => data,
      setData: vi.fn((next: typeof data) => {
        data = [...next];
      }),
      update: vi.fn((bar: (typeof data)[number]) => {
        if (data.at(-1)?.time === bar.time) data[data.length - 1] = bar;
        else data.push(bar);
      }),
      applyOptions: vi.fn(),
    };
    const volumeSeries = {
      applyOptions: applyVolumeOptions,
      setData: vi.fn((next: typeof volumeData) => {
        volumeData = [...next];
      }),
      update: vi.fn((bar: (typeof volumeData)[number]) => {
        if (volumeData.at(-1)?.time === bar.time) volumeData[volumeData.length - 1] = bar;
        else volumeData.push(bar);
      }),
    };
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

  it("hides the volume series without rebuilding the price chart", () => {
    const candles = bars(0, 2);
    const view = render(<CandleChart candles={candles} />);
    expect(applyVolumeOptions).toHaveBeenLastCalledWith({ visible: true });

    view.rerender(<CandleChart candles={candles} showVolume={false} />);

    expect(applyVolumeOptions).toHaveBeenLastCalledWith({ visible: false });
    expect(mocks.createChart).toHaveBeenCalledTimes(1);
    expect(data).toHaveLength(candles.length);
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

  it("keeps every live interval, its volume, and the viewport when an older page arrives", () => {
    const recent: CandleHistoryPage = {
      from: START + 100 * 60_000,
      to: START + 200 * 60_000,
      candles: bars(100, 200),
      noMoreData: false,
    };
    const pages = [recent];
    const loadOlder = vi.fn();
    const live = bars(200, 203).map((bar, index) => ({ ...bar, volume: (index + 1) * 20 }));
    const view = render(<CandleChart candles={recent.candles} historyPages={pages} onLoadOlder={loadOlder} />);
    for (const candle of live) {
      view.rerender(
        <CandleChart candles={recent.candles} historyPages={pages} liveCandle={candle} onLoadOlder={loadOlder} />,
      );
    }
    expect(data.map((bar) => bar.time)).toEqual([...recent.candles, ...live].map((bar) => bar.time / 1000));
    moveRange(100, 102);
    const older: CandleHistoryPage = {
      from: START + 50 * 60_000,
      to: recent.from,
      candles: bars(50, 100),
      noMoreData: false,
    };
    view.rerender(
      <CandleChart
        candles={[...older.candles, ...recent.candles]}
        historyPages={[recent, older]}
        liveCandle={live.at(-1)}
        onLoadOlder={loadOlder}
      />,
    );

    expect(data.map((bar) => bar.time)).toEqual(
      [...older.candles, ...recent.candles, ...live].map((bar) => bar.time / 1000),
    );
    expect(volumeData.slice(-3).map((bar) => bar.value)).toEqual([20, 40, 60]);
    expect(setVisibleLogicalRange).toHaveBeenLastCalledWith({ from: 150, to: 152 });
  });

  it("retires corrected and deleted live intervals within a refreshed window without restoring them on later paging", () => {
    const recent: CandleHistoryPage = {
      from: START,
      to: START + 60_000,
      candles: bars(0, 1),
      noMoreData: false,
    };
    const pages = [recent];
    const live = bars(1, 4);
    const view = render(<CandleChart candles={recent.candles} historyPages={pages} />);
    for (const candle of live) {
      view.rerender(<CandleChart candles={recent.candles} historyPages={pages} liveCandle={candle} />);
    }
    const corrected = { ...live[0]!, close: 1.5, volume: 75 };
    const refreshed = { ...recent, to: START + 4 * 60_000, candles: [...recent.candles, corrected] };
    view.rerender(<CandleChart candles={refreshed.candles} historyPages={[refreshed]} liveCandle={live.at(-1)} />);
    expect(data.map((bar) => ({ time: bar.time, close: bar.close }))).toEqual(
      refreshed.candles.map((bar) => ({ time: bar.time / 1000, close: bar.close })),
    );
    expect(volumeData.map((bar) => bar.value)).toEqual([10, 75]);

    const older = { ...recent, from: START - 60_000, to: START, candles: bars(-1, 0) };
    view.rerender(
      <CandleChart
        candles={[...older.candles, ...refreshed.candles]}
        historyPages={[refreshed, older]}
        liveCandle={live.at(-1)}
      />,
    );
    expect(data.map((bar) => bar.time)).toEqual([-1, 0, 1].map((minute) => START / 1000 + minute * 60));
  });

  it("keeps a live update to an unchanged page while paging, then honors an identical authoritative snapshot", () => {
    const recent: CandleHistoryPage = { from: START, to: START + 60_000, candles: bars(0, 1), noMoreData: false };
    const pages = [recent];
    const live = { ...recent.candles[0]!, close: 1.5, volume: 25 };
    const view = render(<CandleChart candles={recent.candles} historyPages={pages} />);
    view.rerender(<CandleChart candles={recent.candles} historyPages={pages} liveCandle={live} />);
    const older = { ...recent, from: START - 60_000, to: START, candles: bars(-1, 0) };
    const history = [...older.candles, ...recent.candles];
    view.rerender(<CandleChart candles={history} historyPages={[recent, older]} liveCandle={live} />);
    expect(data.at(-1)?.close).toBe(1.5);
    expect(volumeData.at(-1)?.value).toBe(25);

    view.rerender(<CandleChart candles={history} historyPages={[{ ...recent }, older]} liveCandle={live} />);
    expect(data.at(-1)?.close).toBe(2);
    expect(volumeData.at(-1)?.value).toBe(10);
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
