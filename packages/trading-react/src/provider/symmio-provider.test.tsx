import type { Config, GetClientFn, SymmioWalletClient } from "@symmio/trading-core";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { createPublicClient, createWalletClient, http, type Account, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, base } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { WagmiProvider, type Config as WagmiConfig } from "wagmi";
import { connect } from "wagmi/actions";
import { createTestQueryClient, createTestWagmiConfig, TEST_EOA } from "../test/test-utils";
import { SymmioProvider } from "./symmio-provider";
import { useSymmioChainId } from "./use-symmio-chain-id";
import { useSymmioConfig } from "./use-symmio-config";

/**
 * Anvil deterministic test account #1 — stands in for a session key: a signer
 * the wagmi config has never heard of. Public, never used on a real chain.
 */
const SESSION_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const sessionAccount: Account = privateKeyToAccount(SESSION_PRIVATE_KEY);

/** Minimal per-chain SYMMIO config: Arbitrum with a placeholder affiliate. */
const TEST_SYMMIO_CONFIG = {
  [arbitrum.id]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" as const } },
};

/**
 * Render `useSymmioConfig` under a `SymmioProvider` so the test can call the
 * config's `getWalletClient` — the seam the default resolver lives behind.
 *
 * @param options.connected - `false` renders with no wallet available.
 * @param options.getClient - Read-client resolver prop to pass through; omitted
 *   for the wagmi-backed default.
 * @param options.getWalletClient - Resolver prop to pass through; omitted for
 *   the default-resolver cases.
 */
async function renderSymmioConfig(
  options: { connected?: boolean; getClient?: GetClientFn; getWalletClient?: Config["getWalletClient"] } = {},
): Promise<Config> {
  const wagmiConfig: WagmiConfig = createTestWagmiConfig({ connected: options.connected });
  if (options.connected !== false) await connect(wagmiConfig, { connector: wagmiConfig.connectors[0]! });

  const queryClient = createTestQueryClient();
  const { result } = renderHook(() => useSymmioConfig(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SymmioProvider
            symmioConfig={TEST_SYMMIO_CONFIG}
            getClient={options.getClient}
            getWalletClient={options.getWalletClient}
          >
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

    const client = await config.getWalletClient({ chainId: arbitrum.id });

    expect(client.account.address).toBe(TEST_EOA);
  });

  it("returns the wagmi-connected wallet when `from` is the connected account", async () => {
    const config = await renderSymmioConfig();

    const client = await config.getWalletClient({ chainId: arbitrum.id, from: TEST_EOA });

    expect(client.account.address).toBe(TEST_EOA);
  });

  it("matches `from` against the connected account case-insensitively", async () => {
    const config = await renderSymmioConfig();

    const client = await config.getWalletClient({
      chainId: arbitrum.id,
      from: TEST_EOA.toLowerCase() as `0x${string}`,
    });

    expect(client.account.address).toBe(TEST_EOA);
  });

  it("throws SESSION_SIGNER_UNAVAILABLE instead of silently signing with the connected wallet", async () => {
    const config = await renderSymmioConfig();

    const rejection = config.getWalletClient({ chainId: arbitrum.id, from: sessionAccount.address });

    await expect(rejection).rejects.toMatchObject({ kind: "config", code: "SESSION_SIGNER_UNAVAILABLE" });
    await expect(rejection).rejects.toThrow(sessionAccount.address);
    await expect(rejection).rejects.toThrow("createSessionKeyWalletClientResolver");
  });

  it("still throws NO_WALLET_CONNECTED when no wallet is connected", async () => {
    const config = await renderSymmioConfig({ connected: false });

    await expect(config.getWalletClient({ chainId: arbitrum.id })).rejects.toMatchObject({
      kind: "config",
      code: "NO_WALLET_CONNECTED",
    });
  });

  it("uses the `getWalletClient` prop verbatim, including for a `from` the default could not honor", async () => {
    /** A real client, so no cast is needed: the prop's return type is the assertion. */
    const sessionClient: SymmioWalletClient = createWalletClient({
      account: sessionAccount,
      chain: arbitrum,
      transport: http(),
    });
    const getWalletClient = vi.fn(async () => sessionClient);

    const config = await renderSymmioConfig({ getWalletClient });
    const client = await config.getWalletClient({ chainId: arbitrum.id, from: sessionAccount.address });

    expect(client).toBe(sessionClient);
    expect(getWalletClient).toHaveBeenCalledWith({ chainId: arbitrum.id, from: sessionAccount.address });
  });
});

describe("SymmioProvider read-client resolver", () => {
  /** An app-owned client; creating it makes no RPC call. */
  const appClient: PublicClient = createPublicClient({ chain: arbitrum, transport: http() });

  it("reads through the `getClient` prop instead of wagmi's public client", async () => {
    const getClient = vi.fn(() => appClient);

    const config = await renderSymmioConfig({ getClient });

    expect(config.getClient({ chainId: arbitrum.id })).toBe(appClient);
    expect(getClient).toHaveBeenCalledWith({ chainId: arbitrum.id });
  });

  it("hands the `getClient` prop the resolved default chain when the caller omits `chainId`", async () => {
    const getClient = vi.fn(() => appClient);

    const config = await renderSymmioConfig({ getClient });
    config.getClient();

    expect(getClient).toHaveBeenCalledWith({ chainId: config.defaultChainId });
  });

  it("falls back to wagmi's public client for the requested chain when the prop is omitted", async () => {
    const config = await renderSymmioConfig();

    expect(config.getClient({ chainId: arbitrum.id }).chain?.id).toBe(arbitrum.id);
  });
});

describe("SymmioProvider chain selection", () => {
  /** Both supported chains configured, so the wallet's chain is a valid default. */
  const MULTI_CHAIN_SYMMIO_CONFIG = {
    [arbitrum.id]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" as const } },
    [base.id]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF2" as const } },
  };

  /**
   * Render under a wallet connected on Base (the first wagmi chain) and return
   * the provider config's default chain and `useSymmioChainId()`.
   */
  async function renderOnBase(props: { chainId?: number; defaultChainId?: number } = {}) {
    const wagmiConfig: WagmiConfig = createTestWagmiConfig({ chains: [base, arbitrum] });
    await connect(wagmiConfig, { connector: wagmiConfig.connectors[0]! });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => ({ config: useSymmioConfig(), chainId: useSymmioChainId() }), {
      wrapper: ({ children }: PropsWithChildren) => (
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <SymmioProvider symmioConfig={MULTI_CHAIN_SYMMIO_CONFIG} {...props}>
              {children}
            </SymmioProvider>
          </QueryClientProvider>
        </WagmiProvider>
      ),
    });

    return result.current;
  }

  it("follows the connected wallet's supported chain when no `chainId` is pinned", async () => {
    const { config, chainId } = await renderOnBase({ defaultChainId: arbitrum.id });

    expect(config.defaultChainId).toBe(base.id);
    expect(config.getChainConfig().chainId).toBe(base.id);
    expect(chainId).toBe(base.id);
  });

  it("keeps every default on the pinned `chainId` while the wallet is on another supported chain", async () => {
    const { config, chainId } = await renderOnBase({ chainId: arbitrum.id });

    expect(config.defaultChainId).toBe(arbitrum.id);
    expect(config.getChainConfig().chainId).toBe(arbitrum.id);
    expect(chainId).toBe(arbitrum.id);
  });

  it("lets the pinned `chainId` win over `defaultChainId`", async () => {
    const { config, chainId } = await renderOnBase({ chainId: arbitrum.id, defaultChainId: base.id });

    expect(config.defaultChainId).toBe(arbitrum.id);
    expect(chainId).toBe(arbitrum.id);
  });
});
