"use client";

import { wagmiConfig } from "@/config/wagmi";
import { SymmioOverridesProvider, useSymmioOverrides } from "@/features/config/symmio-overrides-store";
import { getAppSessionKeyManager } from "@/features/session-keys/session-key-manager";
import { SymmError, SymmioProvider, type GetWalletClientFn, type SymmioWalletClient } from "@symm-frontier/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { WagmiProvider } from "wagmi";
import { getWalletClient as getWagmiWalletClient } from "wagmi/actions";

/**
 * Feeds the runtime overrides store into `SymmioProvider` and wires a custom
 * wallet-client resolver: when `from` matches the in-memory session key, sign
 * with the session-key viem client; otherwise fall back to the wagmi-connected
 * EOA.
 */
function SymmioConfigBridge({ children }: { children: ReactNode }) {
  const { overrides } = useSymmioOverrides();

  const getWalletClient = useCallback<GetWalletClientFn>(async ({ chainId, from }) => {
    const manager = getAppSessionKeyManager();
    const sessionAddress = manager.getAddress();
    const wantsSession = from && sessionAddress && from.toLowerCase() === sessionAddress.toLowerCase();

    if (wantsSession) {
      const privateKey = manager.getPrivateKey();
      if (!privateKey) {
        throw new SymmError(
          "config",
          "SESSION_KEY_NOT_LOADED",
          "Session key matched the requested signer but no private key is loaded.",
        );
      }
      const chain = wagmiConfig.chains.find((c) => c.id === chainId);
      if (!chain) {
        throw new SymmError("config", "UNSUPPORTED_CHAIN", `Unsupported chain id: ${chainId}.`);
      }
      const account = privateKeyToAccount(privateKey);
      return createWalletClient({ account, chain, transport: http() }) as unknown as SymmioWalletClient;
    }

    try {
      return await getWagmiWalletClient(wagmiConfig, { chainId });
    } catch (err) {
      throw new SymmError(
        "config",
        "NO_WALLET_CONNECTED",
        "No connected wallet. Connect a wallet before sending transactions.",
        { cause: err instanceof Error ? err : undefined },
      );
    }
  }, []);

  return (
    <SymmioProvider chainOverrides={overrides} getWalletClient={getWalletClient}>
      {children}
    </SymmioProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  /**
   * One `QueryClient` per browser session. Created lazily inside `useState`
   * (not at module scope) so Next.js's SSR pass and the client hydration share
   * a single instance — module-scope `new QueryClient()` would create two.
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /** SDK reads are cheap; default retry behavior is fine but we cap latency. */
            retry: 2,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SymmioOverridesProvider>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <SymmioConfigBridge>{children}</SymmioConfigBridge>
          </QueryClientProvider>
        </WagmiProvider>
      </SymmioOverridesProvider>
    </ThemeProvider>
  );
}
