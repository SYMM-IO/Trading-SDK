import * as core from "@symmio/trading-core";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useEnigmaPrices } from "./use-enigma-prices";

afterEach(() => vi.restoreAllMocks());

function captureSubscriptions() {
  const subscriptions: { parameters: core.WatchEnigmaPricesParameters; stop: ReturnType<typeof vi.fn> }[] = [];
  vi.spyOn(core, "watchEnigmaPrices").mockImplementation((_config, parameters) => {
    const stop = vi.fn();
    subscriptions.push({ parameters, stop });
    parameters.onStatusChange?.("connecting");
    return stop;
  });
  return subscriptions;
}

describe("useEnigmaPrices deployment lifecycle", () => {
  it("clears prices, status and errors when config changes and ignores departed callbacks", () => {
    const subscriptions = captureSubscriptions();
    const first = createMockSymmioConfig().config;
    const second = createMockSymmioConfig().config;
    const onTick = vi.fn();
    const { result, rerender, unmount } = renderHookWithProviders(({ config }) => useEnigmaPrices({ config, onTick }), {
      initialProps: { config: first },
    });
    const old = subscriptions[0]!;
    act(() => {
      old.parameters.onStatusChange?.("open");
      old.parameters.onPrices([{ name: "STAGING_ONLY", markPrice: "0.000000123456789" }]);
      old.parameters.onError?.(new core.SymmError("api", "OLD_FEED", "old failure"));
    });
    expect(result.current.error).not.toBeNull();
    rerender({ config: second });
    expect(old.stop).toHaveBeenCalledOnce();
    expect(result.current.prices).toEqual({});
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("connecting");

    act(() => {
      old.parameters.onPrices([{ name: "LATE_OLD", markPrice: "999" }]);
      old.parameters.onStatusChange?.("open");
      old.parameters.onError?.(new core.SymmError("api", "LATE_FEED", "late failure"));
    });
    expect(result.current.prices).toEqual({});
    expect(result.current.status).toBe("connecting");
    expect(result.current.error).toBeNull();
    expect(onTick).toHaveBeenCalledTimes(1);
    act(() => subscriptions[1]!.parameters.onPrices([{ name: "PRODUCTION_ONLY", markPrice: "2.5" }]));
    expect(result.current.prices).toEqual({ PRODUCTION_ONLY: "2.5" });
    unmount();
    act(() => subscriptions[1]!.parameters.onPrices([{ name: "UNMOUNTED", markPrice: "3" }]));
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it("clears values on a chain switch even while disabled", () => {
    const subscriptions = captureSubscriptions();
    const config = createMockSymmioConfig().config;
    const { result, rerender } = renderHookWithProviders(
      ({ chainId, enabled }) => useEnigmaPrices({ config, chainId, enabled }),
      { initialProps: { chainId: 42161, enabled: true } },
    );
    act(() => subscriptions[0]!.parameters.onPrices([{ name: "OLD_CHAIN", markPrice: "1" }]));
    rerender({ chainId: 8453, enabled: false });
    expect(result.current.prices).toEqual({});
    expect(result.current.status).toBe("closed");
    expect(subscriptions).toHaveLength(1);
    rerender({ chainId: 8453, enabled: true });
    expect(subscriptions[1]!.parameters.chainId).toBe(8453);
    expect(result.current.prices).toEqual({});
  });

  it("retains prices through same-target outages and stop/start but ignores the stopped subscription", () => {
    const subscriptions = captureSubscriptions();
    const config = createMockSymmioConfig().config;
    const onTick = vi.fn();
    const { result, rerender } = renderHookWithProviders(
      ({ enabled }) => useEnigmaPrices({ config, enabled, onTick }),
      { initialProps: { enabled: true } },
    );
    act(() => {
      subscriptions[0]!.parameters.onPrices([{ name: "KEEP", markPrice: "1.230000000000000001" }]);
      subscriptions[0]!.parameters.onStatusChange?.("reconnecting");
    });
    expect(result.current.prices).toEqual({ KEEP: "1.230000000000000001" });
    rerender({ enabled: false });
    expect(result.current.prices).toEqual({ KEEP: "1.230000000000000001" });
    act(() => subscriptions[0]!.parameters.onPrices([{ name: "STOPPED", markPrice: "9" }]));
    expect(onTick).toHaveBeenCalledTimes(1);
    rerender({ enabled: true });
    expect(result.current.prices).toEqual({ KEEP: "1.230000000000000001" });
    act(() => subscriptions[1]!.parameters.onPrices([{ name: "KEEP", markPrice: "2" }]));
    expect(result.current.prices).toEqual({ KEEP: "2" });
  });
});
