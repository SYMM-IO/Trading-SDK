import { act } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { usePendingRevocation } from "./use-pending-revocation";

const ACCOUNT = { addr: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address, isPartyB: false };
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTORS: Hex[] = ["0xaaaaaaaa", "0xbbbbbbbb"];

/** A fixed wall clock, so the ETAs below sit a known distance in the future. */
const NOW_MS = 1_800_000_000_000;
const NOW_SEC = BigInt(NOW_MS / 1000);

/**
 * Advance the fake clock and let React settle.
 *
 * `advanceTimersByTimeAsync` flushes the microtask queue as it steps, which is
 * what lets the query resolve without handing control back to a real clock —
 * `waitFor` would hang here, and `shouldAdvanceTime` would let real elapsed
 * time drift the second boundary the assertions below are counting.
 */
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("usePendingRevocation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down every second while the revocation is pending", async () => {
    const { config, multicall } = createMockSymmioConfig();
    /** Both selectors scheduled, the later one 10s out. */
    multicall.mockResolvedValueOnce([NOW_SEC + 5n, NOW_SEC + 10n]);

    const { result } = renderHookWithProviders(() =>
      usePendingRevocation({ account: ACCOUNT, delegate: DELEGATE, selectors: SELECTORS, config }),
    );

    await tick();
    expect(result.current.isRevoking).toBe(true);
    expect(result.current.secondsRemaining).toBe(10);
    expect(result.current.etaTimestamp).toBe(NOW_SEC + 10n);
    expect(result.current.revokingSelectors).toEqual(SELECTORS);
    expect(result.current.isFinalizable).toBe(false);

    await tick(3_000);
    expect(result.current.secondsRemaining).toBe(7);

    await tick(4_000);
    expect(result.current.secondsRemaining).toBe(3);
    expect(result.current.isRevoking).toBe(true);
  });

  it("flips to finalizable on its own once the last ETA passes", async () => {
    const { config, multicall } = createMockSymmioConfig();
    multicall.mockResolvedValueOnce([NOW_SEC + 2n, NOW_SEC + 4n]);

    const { result } = renderHookWithProviders(() =>
      usePendingRevocation({ account: ACCOUNT, delegate: DELEGATE, selectors: SELECTORS, config }),
    );

    await tick();
    expect(result.current.isRevoking).toBe(true);

    /** The earlier selector elapses first — still not finalizable, finalize would revert. */
    await tick(2_000);
    expect(result.current.isRevoking).toBe(true);
    expect(result.current.isFinalizable).toBe(false);

    await tick(2_000);
    expect(result.current.isRevoking).toBe(false);
    expect(result.current.isFinalizable).toBe(true);
    expect(result.current.secondsRemaining).toBe(0);
    /** The selectors stay scheduled until someone finalizes. */
    expect(result.current.revokingSelectors).toEqual(SELECTORS);
  });

  it("reports nothing pending when no selector is scheduled", async () => {
    const { config, multicall } = createMockSymmioConfig();
    multicall.mockResolvedValueOnce([0n, 0n]);

    const { result } = renderHookWithProviders(() =>
      usePendingRevocation({ account: ACCOUNT, delegate: DELEGATE, selectors: SELECTORS, config }),
    );

    await tick();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRevoking).toBe(false);
    expect(result.current.isFinalizable).toBe(false);
    expect(result.current.secondsRemaining).toBeUndefined();
    expect(result.current.revokingSelectors).toEqual([]);
  });

  it("skips the read entirely for an empty selector list", async () => {
    const { config, multicall } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() =>
      usePendingRevocation({ account: ACCOUNT, delegate: DELEGATE, selectors: [], config }),
    );

    expect(multicall).not.toHaveBeenCalled();
    expect(result.current.isRevoking).toBe(false);
    expect(result.current.isFinalizable).toBe(false);
  });
});
