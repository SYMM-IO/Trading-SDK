import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useCandleStream } from "./use-candle-stream";
import { useCandles } from "./use-candles";
import { useLowcapCandleSource } from "./use-lowcap-candle-source";

describe("useLowcapCandleSource", () => {
  it("renders errors through consuming hooks on an unsupported wallet chain", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => {
      const source = useLowcapCandleSource({ config, chainId: 999999 });
      const history = useCandles({ source, marketName: "TEST", resolution: "1h", from: 0, to: 3_600_000 });
      const stream = useCandleStream({ source, marketName: "TEST", resolution: "1h" });
      return { history, stream };
    });
    await waitFor(() => expect(result.current.history.isError).toBe(true));
    expect(result.current.history.error).toMatchObject({ kind: "sdk", code: "UNSUPPORTED_CHAIN" });
    expect(result.current.stream.error).toMatchObject({ kind: "sdk", code: "UNSUPPORTED_CHAIN" });
  });
  it("memoizes by option values and rebuilds when the flat policy changes", async () => {
    const { config } = createMockSymmioConfig();
    const { result, rerender } = renderHookWithProviders(
      ({ includeFlat }) => useLowcapCandleSource({ config, includeFlat }),
      { initialProps: { includeFlat: true } },
    );
    const initial = result.current;
    rerender({ includeFlat: true });
    expect(result.current).toBe(initial);
    rerender({ includeFlat: false });
    await waitFor(() => expect(result.current).not.toBe(initial));
    expect(result.current.id).not.toBe(initial.id);
    expect(result.current.supportedResolutions).toContain("10m");
    expect(result.current.priceBasis).toBe("price-service");
  });
});
