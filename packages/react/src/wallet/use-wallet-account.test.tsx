import { waitFor } from "@testing-library/react";
import { hyperEvm, mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { createTestWagmiConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useWalletAccount } from "./use-wallet-account";

describe("useWalletAccount", () => {
  it("reports a disconnected wallet with no address or chain", async () => {
    const wagmiConfig = createTestWagmiConfig({ connected: false });

    const { result } = renderHookWithProviders(() => useWalletAccount(), { wagmiConfig });

    await waitFor(() => expect(result.current.isReconnecting).toBe(false));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeUndefined();
    expect(result.current.chainId).toBeUndefined();
    expect(result.current.isOnExpectedChain).toBe(false);
  });

  it("surfaces the connected address, chain, and isOnExpectedChain on a supported chain", async () => {
    const wagmiConfig = createTestWagmiConfig({
      chains: [hyperEvm],
      features: { defaultConnected: true, reconnect: true },
    });

    const { result } = renderHookWithProviders(() => useWalletAccount(), { wagmiConfig });

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.address).toBe(TEST_EOA);
    expect(result.current.chainId).toBe(hyperEvm.id);
    expect(result.current.isOnExpectedChain).toBe(true);
  });

  it("reports isOnExpectedChain false when connected to a chain the SDK does not support", async () => {
    const wagmiConfig = createTestWagmiConfig({
      chains: [mainnet],
      features: { defaultConnected: true, reconnect: true },
    });

    const { result } = renderHookWithProviders(() => useWalletAccount(), { wagmiConfig });

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.chainId).toBe(mainnet.id);
    expect(result.current.isOnExpectedChain).toBe(false);
  });
});
