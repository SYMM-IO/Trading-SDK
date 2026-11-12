import { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { automaticAttemptKey, finishAutomaticAttempt, reserveAutomaticAttempt } from "./automatic-timelock-attempt";
import { useAutomaticTimelockRecovery } from "./use-automatic-timelock-recovery";

const ROOT = "0x1111111111111111111111111111111111111111" as const;

describe("useAutomaticTimelockRecovery", () => {
  it("protects pending work, exposes uncertainty and allows explicit reconciliation", () => {
    const { config } = createMockSymmioConfig();
    const client = new QueryClient();
    const key = automaticAttemptKey(42161, config.getChainConfig(42161).addresses.accountLayerAddress, ROOT);
    const token = {};
    const { result } = renderHookWithProviders(
      () => useAutomaticTimelockRecovery({ config, chainId: 42161, rootAccount: ROOT }),
      { queryClient: client },
    );
    act(() => reserveAutomaticAttempt(client, key, token));
    expect(result.current.status).toBe("pending");
    expect(() => result.current.clearAfterReconciliation()).toThrow(/still pending/);
    expect(() => reserveAutomaticAttempt(client, key, {})).toThrow(/reconciliation/);
    act(() => finishAutomaticAttempt(client, key, token, false));
    expect(result.current.status).toBe("reconciliation");
    act(() => result.current.clearAfterReconciliation());
    expect(result.current.status).toBe("idle");
    act(() => reserveAutomaticAttempt(client, key, {}));
    expect(result.current.status).toBe("pending");
  });

  it("releases the slot only for the owner after a confirmed receipt", () => {
    const client = new QueryClient();
    const { config } = createMockSymmioConfig();
    const key = automaticAttemptKey(42161, config.getChainConfig(42161).addresses.accountLayerAddress, ROOT);
    const token = {};
    reserveAutomaticAttempt(client, key, token);
    finishAutomaticAttempt(client, key, {}, true);
    expect(() => reserveAutomaticAttempt(client, key, {})).toThrow(/reconciliation/);
    finishAutomaticAttempt(client, key, token, true);
    expect(() => reserveAutomaticAttempt(client, key, {})).not.toThrow();
  });
});
