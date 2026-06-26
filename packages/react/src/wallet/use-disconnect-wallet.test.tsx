import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTestWagmiConfig, renderHookWithProviders } from "../test/test-utils";
import { useDisconnectWallet } from "./use-disconnect-wallet";
import { useWalletAccount } from "./use-wallet-account";

/**
 * The hook's `catch` arm (rethrowing `normalizeSymmError(err)`) is intentionally
 * not covered here: the wagmi `mock` connector exposes no disconnect-error
 * feature, so the failure cannot be driven through the real connector this suite
 * uses. That arm is identical to the connect/switch wrappers, whose reject paths
 * are exercised in `use-connect-wallet.test.tsx` and `use-switch-to-symmio-chain.test.tsx`.
 */
describe("useDisconnectWallet", () => {
  it("disconnects the wallet and the change propagates to useWalletAccount", async () => {
    const wagmiConfig = createTestWagmiConfig({ features: { defaultConnected: true, reconnect: true } });
    const { result } = renderHookWithProviders(
      () => ({ disconnect: useDisconnectWallet(), account: useWalletAccount() }),
      { wagmiConfig },
    );

    await waitFor(() => expect(result.current.account.isConnected).toBe(true));

    await act(async () => {
      await result.current.disconnect.disconnect();
    });

    await waitFor(() => expect(result.current.account.isConnected).toBe(false));
    expect(result.current.disconnect.status).toBe("success");
    expect(result.current.account.address).toBeUndefined();
  });

  it("resolves without throwing when no wallet is connected", async () => {
    const { result } = renderHookWithProviders(() => useDisconnectWallet());

    await act(async () => {
      await expect(result.current.disconnect()).resolves.toBeUndefined();
    });
  });
});
