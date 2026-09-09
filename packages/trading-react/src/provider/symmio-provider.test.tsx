import type { Config, SymmioWalletClient } from "@symmio/trading-core";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { createWalletClient, http, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hyperEvm } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { WagmiProvider, type Config as WagmiConfig } from "wagmi";
import { connect } from "wagmi/actions";
import { createTestQueryClient, createTestWagmiConfig, TEST_EOA } from "../test/test-utils";
import { SymmioProvider } from "./symmio-provider";
import { useSymmioConfig } from "./use-symmio-config";

/**
 * Anvil deterministic test account #1 — stands in for a session key: a signer
 * the wagmi config has never heard of. Public, never used on a real chain.
 */
const SESSION_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const sessionAccount: Account = privateKeyToAccount(SESSION_PRIVATE_KEY);

/** Minimal per-chain SYMMIO config: HyperEVM with a placeholder affiliate. */
const TEST_SYMMIO_CONFIG = {
  [hyperEvm.id]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" as const } },
};

/**
 * Render `useSymmioConfig` under a `SymmioProvider` so the test can call the
 * config's `getWalletClient` — the seam the default resolver lives behind.
 *
 * @param options.connected - `false` renders with no wallet available.
 * @param options.getWalletClient - Resolver prop to pass through; omitted for
 *   the default-resolver cases.
 */
async function renderSymmioConfig(
  options: { connected?: boolean; getWalletClient?: Config["getWalletClient"] } = {},
): Promise<Config> {
  const wagmiConfig: WagmiConfig = createTestWagmiConfig({ connected: options.connected });
  if (options.connected !== false) await connect(wagmiConfig, { connector: wagmiConfig.connectors[0]! });

  const queryClient = createTestQueryClient();
  const { result } = renderHook(() => useSymmioConfig(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SymmioProvider symmioConfig={TEST_SYMMIO_CONFIG} getWalletClient={options.getWalletClient}>
            {children}
          </SymmioProvider>
        </QueryClientProvider>
      </WagmiProvider>
    ),
  });

  return result.current;
}

describe("SymmioProvider default wallet-client resolver", () => {
  it("returns the wagmi-connected wallet when no `from` is requested", async () => {
    const config = await renderSymmioConfig();

    const client = await config.getWalletClient({ chainId: hyperEvm.id });

    expect(client.account.address).toBe(TEST_EOA);
  });

  it("returns the wagmi-connected wallet when `from` is the connected account", async () => {
    const config = await renderSymmioConfig();

    const client = await config.getWalletClient({ chainId: hyperEvm.id, from: TEST_EOA });

    expect(client.account.address).toBe(TEST_EOA);
  });

  it("matches `from` against the connected account case-insensitively", async () => {
    const config = await renderSymmioConfig();

    const client = await config.getWalletClient({
      chainId: hyperEvm.id,
      from: TEST_EOA.toLowerCase() as `0x${string}`,
    });

    expect(client.account.address).toBe(TEST_EOA);
  });

  it("throws SESSION_SIGNER_UNAVAILABLE instead of silently signing with the connected wallet", async () => {
    const config = await renderSymmioConfig();

    const rejection = config.getWalletClient({ chainId: hyperEvm.id, from: sessionAccount.address });

    await expect(rejection).rejects.toMatchObject({ kind: "config", code: "SESSION_SIGNER_UNAVAILABLE" });
    await expect(rejection).rejects.toThrow(sessionAccount.address);
    await expect(rejection).rejects.toThrow("createSessionKeyWalletClientResolver");
  });

  it("still throws NO_WALLET_CONNECTED when no wallet is connected", async () => {
    const config = await renderSymmioConfig({ connected: false });

    await expect(config.getWalletClient({ chainId: hyperEvm.id })).rejects.toMatchObject({
      kind: "config",
      code: "NO_WALLET_CONNECTED",
    });
  });

  it("uses the `getWalletClient` prop verbatim, including for a `from` the default could not honor", async () => {
    /** A real client, so no cast is needed: the prop's return type is the assertion. */
    const sessionClient: SymmioWalletClient = createWalletClient({
      account: sessionAccount,
      chain: hyperEvm,
      transport: http(),
    });
    const getWalletClient = vi.fn(async () => sessionClient);

    const config = await renderSymmioConfig({ getWalletClient });
    const client = await config.getWalletClient({ chainId: hyperEvm.id, from: sessionAccount.address });

    expect(client).toBe(sessionClient);
    expect(getWalletClient).toHaveBeenCalledWith({ chainId: hyperEvm.id, from: sessionAccount.address });
  });
});
