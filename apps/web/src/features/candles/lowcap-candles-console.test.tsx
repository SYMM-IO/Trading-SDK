import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LowcapCandlesConsole } from "./lowcap-candles-console";

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  source: vi.fn(),
  chart: vi.fn(),
  stream: vi.fn(),
  loadOlder: vi.fn(),
  refresh: vi.fn(),
  exhausted: false,
}));
const RESOLUTIONS = ["1m", "5m", "10m", "15m", "30m", "1h", "4h", "6h", "12h", "1d", "1w", "1M"];

vi.mock("@symmio/trading-react", () => ({
  useLowcapCandleSource: mocks.source,
  useCandleHistory: mocks.history,
  useCandleStream: mocks.stream,
  useEnigmaPriceServiceSymbolsInfo: () => ({ data: [{ name: "EMPTY::Ab_SFLOW", address: "AbCd" }], isLoading: false }),
}));
vi.mock("../inspector/method-card", () => ({
  MethodCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock("./candle-chart", () => ({
  CandleChart: (props: { emptyLabel: string }) => {
    mocks.chart(props);
    return <div>{props.emptyLabel}</div>;
  },
}));
vi.mock("@symmio/ui/components/market-select", () => ({ MarketSelect: () => <div>Market picker</div> }));

describe("lowcap candle inspector", () => {
  beforeEach(() => {
    mocks.source.mockReset();
    mocks.history.mockReset();
    mocks.chart.mockReset();
    mocks.exhausted = false;
    mocks.loadOlder.mockReset();
    mocks.refresh.mockReset();
    mocks.stream.mockReset();
    mocks.stream.mockReturnValue({ candle: null, status: "closed", error: null });
    mocks.source.mockReturnValue({ id: "lowcap-test", supportedResolutions: RESOLUTIONS });
    mocks.history.mockImplementation(() => ({
      data: { candles: [], noMoreData: mocks.exhausted },
      isLoading: false,
      isFetching: false,
      error: null,
      loadOlder: mocks.loadOlder,
      refresh: mocks.refresh,
    }));
  });
  afterEach(() => cleanup());

  it("requests the selected full market name at every supported resolution", () => {
    render(<LowcapCandlesConsole />);
    for (const resolution of RESOLUTIONS) {
      fireEvent.click(screen.getByRole("button", { name: resolution }));
      expect(mocks.history.mock.lastCall?.[0]).toMatchObject({ marketName: "EMPTY::Ab_SFLOW", resolution });
    }
    expect(screen.getByText(/Volume: USD/)).toBeTruthy();
    expect(mocks.source.mock.calls[0]?.[0].includeFlat).toBe(false);
    fireEvent.click(screen.getByRole("switch", { name: "Include flat candles" }));
    expect(mocks.source.mock.lastCall?.[0].includeFlat).toBe(true);
  });

  it("delegates gestures, refresh, and stream resets to the SDK without expanding the initial range", () => {
    render(<LowcapCandlesConsole />);
    expect(screen.getByText(/No candles in this window/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load older" })).toBeNull();
    const initial = mocks.history.mock.lastCall?.[0];
    expect(initial.followLatest).toBe(true);
    expect(initial.query).toMatchObject({ refetchOnWindowFocus: false, retry: 1 });
    act(() => mocks.chart.mock.lastCall?.[0].onLoadOlder());
    expect(mocks.loadOlder).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    act(() => mocks.stream.mock.lastCall?.[0].onReset());
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    const correction = { from: initial.to - 60_000, to: initial.to };
    act(() => mocks.stream.mock.lastCall?.[0].onReset(correction));
    expect(mocks.refresh).toHaveBeenLastCalledWith(correction);
    expect(mocks.history.mock.lastCall?.[0].from).toBe(initial.from);
    expect(mocks.history.mock.lastCall?.[0].to).toBe(initial.to);
  });

  it("shows a listed market with confirmed no history without an error", () => {
    mocks.exhausted = true;
    render(<LowcapCandlesConsole />);
    expect(screen.getByText("No candle history available.")).toBeTruthy();
    const previousFrom = mocks.history.mock.lastCall?.[0].from;
    act(() => mocks.chart.mock.lastCall?.[0].onLoadOlder());
    expect(mocks.history.mock.lastCall?.[0].from).toBe(previousFrom);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains staging setup and keeps a failed history request distinct from an empty result", () => {
    mocks.history.mockReturnValue({
      data: undefined,
      loadOlder: mocks.loadOlder,
      refresh: mocks.refresh,
      isLoading: false,
      isFetching: false,
      error: { kind: "api", message: "FETCH_ENIGMA_OHLCV_FAILED: Request failed with status code 404" },
    });
    render(<LowcapCandlesConsole />);
    expect(screen.getByText(/Open SDK config in the header and choose “Use staging”/)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("404");
    expect(screen.getByText("Candle history could not be loaded.")).toBeTruthy();
    expect(screen.queryByText(/No candles in this window/)).toBeNull();
    expect(screen.queryByText(/0 bars/)).toBeNull();
    expect(screen.queryByText(/Pan or zoom toward older dates to load another window/)).toBeNull();
    const previousFrom = mocks.history.mock.lastCall?.[0].from;
    act(() => mocks.chart.mock.lastCall?.[0].onLoadOlder());
    expect(mocks.history.mock.lastCall?.[0].from).toBe(previousFrom);
    expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders retained SDK data alongside an older-page error", () => {
    const candles = [{ time: 1_800_000_000_000, open: 1, high: 2, low: 1, close: 2, volume: 10 }];
    mocks.history.mockReturnValue({
      data: { candles, noMoreData: false },
      isFetching: false,
      error: { kind: "api", message: "Offline" },
      loadOlder: mocks.loadOlder,
      refresh: mocks.refresh,
    });
    render(<LowcapCandlesConsole />);
    expect(mocks.chart.mock.lastCall?.[0].candles).toEqual(candles);
    expect(screen.getByRole("alert").textContent).toContain("Offline");
  });
});
