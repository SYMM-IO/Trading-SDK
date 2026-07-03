import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { createTestWagmiConfig, renderHookWithProviders } from "../test/test-utils";
import { useConnectWallet } from "./use-connect-wallet";
import { useWalletAccount } from "./use-wallet-account";

describe("useConnectWallet", () => {
  it("exposes the host's registered connectors and starts idle", () => {
    const { result } = renderHookWithProviders(() => useConnectWallet());

    expect(result.current.connectors.length).toBeGreaterThan(0);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeUndefined();
  });

  it("connects the wallet and the connection propagates to useWalletAccount", async () => {
    const wagmiConfig = createTestWagmiConfig();
    const { result } = renderHookWithProviders(() => ({ connect: useConnectWallet(), account: useWalletAccount() }), {
      wagmiConfig,
    });

    await act(async () => {
      await result.current.connect.connect(result.current.connect.connectors[0]!);
    });

    await waitFor(() => expect(result.current.account.isConnected).toBe(true));
    await waitFor(() => expect(result.current.connect.status).toBe("success"));
    expect(result.current.connect.error).toBeUndefined();
    expect(result.current.account.isOnExpectedChain).toBe(true);
  });

  it("throws a normalized SymmioRequestError and surfaces it when the connector rejects", async () => {
    const wagmiConfig = createTestWagmiConfig({ features: { connectError: true } });
    const { result } = renderHookWithProviders(() => useConnectWallet(), { wagmiConfig });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.connect(result.current.connectors[0]!);
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(SymmioRequestError);
    expect((thrown as SymmioRequestError).kind).toBe("user-rejected");
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.kind).toBe("user-rejected");
  });
});
