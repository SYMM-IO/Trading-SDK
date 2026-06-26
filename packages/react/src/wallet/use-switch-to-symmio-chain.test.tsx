import { act, waitFor } from "@testing-library/react";
import { hyperEvm, mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { createTestWagmiConfig, renderHookWithProviders } from "../test/test-utils";
import { useSwitchToSymmioChain } from "./use-switch-to-symmio-chain";
import { useWalletAccount } from "./use-wallet-account";

describe("useSwitchToSymmioChain", () => {
  it("switches the connected wallet to the SDK default chain", async () => {
    const wagmiConfig = createTestWagmiConfig({
      chains: [mainnet, hyperEvm],
      features: { defaultConnected: true, reconnect: true },
    });
    const { result } = renderHookWithProviders(
      () => ({ switchToSymmio: useSwitchToSymmioChain(), account: useWalletAccount() }),
      { wagmiConfig },
    );

    await waitFor(() => expect(result.current.account.isConnected).toBe(true));
    expect(result.current.account.chainId).toBe(mainnet.id);
    expect(result.current.account.isOnExpectedChain).toBe(false);

    await act(async () => {
      await result.current.switchToSymmio.switchChain();
    });

    await waitFor(() => expect(result.current.account.chainId).toBe(hyperEvm.id));
    expect(result.current.switchToSymmio.status).toBe("success");
    expect(result.current.account.isOnExpectedChain).toBe(true);
  });

  it("throws a normalized SymmioRequestError and surfaces it when the switch is rejected", async () => {
    const wagmiConfig = createTestWagmiConfig({
      chains: [mainnet, hyperEvm],
      features: { defaultConnected: true, reconnect: true, switchChainError: true },
    });
    const { result } = renderHookWithProviders(
      () => ({ switchToSymmio: useSwitchToSymmioChain(), account: useWalletAccount() }),
      { wagmiConfig },
    );

    await waitFor(() => expect(result.current.account.isConnected).toBe(true));

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.switchToSymmio.switchChain();
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(SymmioRequestError);
    expect((thrown as SymmioRequestError).kind).toBe("user-rejected");
    await waitFor(() => expect(result.current.switchToSymmio.status).toBe("error"));
    expect(result.current.switchToSymmio.error?.kind).toBe("user-rejected");
  });
});
