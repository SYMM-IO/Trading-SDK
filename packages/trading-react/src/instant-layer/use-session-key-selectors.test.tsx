import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSessionKeySelectors } from "./use-session-key-selectors";

describe("useSessionKeySelectors", () => {
  it("updates independent protected scopes and keeps unchanged results stable without RPC", () => {
    const { config, readContract } = createMockSymmioConfig();
    let coreCalls = false;
    let timelockScheduling = false;
    const { result, rerender } = renderHookWithProviders(() =>
      useSessionKeySelectors({ config, chainId: 42161, trade: false, account: false, coreCalls, timelockScheduling }),
    );
    expect(result.current).toEqual([]);
    coreCalls = true;
    rerender();
    expect(result.current).toEqual(["0xbd367d8e"]);
    const stable = result.current;
    rerender();
    expect(result.current).toBe(stable);
    timelockScheduling = true;
    rerender();
    expect(result.current).toEqual(["0xbd367d8e", "0x1ee3e0cf"]);
    coreCalls = false;
    rerender();
    expect(result.current).toEqual(["0x1ee3e0cf"]);
    timelockScheduling = false;
    rerender();
    expect(result.current).toEqual([]);
    expect(readContract).not.toHaveBeenCalled();
  });
});
