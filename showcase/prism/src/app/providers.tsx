"use client";

import { symmioChains } from "@/config/symmio";
import { wagmiConfig } from "@/config/wagmi";
import { ModeProvider } from "@/features/mode/mode-provider";
import { usePrismWalletClient } from "@/features/session-key/use-prism-wallet-client";
import { SymmioProvider } from "@symmio/trading-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { WagmiProvider } from "wagmi";

/**
 * The whole provider stack.
 *
 * `SymmioProvider` must sit inside both `WagmiProvider` and
 * `QueryClientProvider` — it builds one immutable SDK `Config` holding every
 * chain and every solver, and every hook selects its target per call.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SymmioBridge>{children}</SymmioBridge>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/**
 * Supplies the SDK's signer resolver.
 *
 * It has to be its own component because `usePrismWalletClient` reads the
 * session-key manager through a hook, and a hook cannot run in the same
 * component that mounts `WagmiProvider` above it.
 */
function SymmioBridge({ children }: { children: ReactNode }) {
  const getWalletClient = usePrismWalletClient();

  return (
    <SymmioProvider symmioConfig={symmioChains} getWalletClient={getWalletClient}>
      <ModeProvider>{children}</ModeProvider>
    </SymmioProvider>
  );
}
