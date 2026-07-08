"use client";

import { useAppGetWalletClient } from "@/app/use-app-wallet-client";
import { wagmiConfig } from "@/config/wagmi";
import { SymmioOverridesProvider, useSymmioOverrides } from "@/features/config/symmio-overrides-store";
import { MagicPopoutProvider } from "@/features/magic-sidebar/magic-popout-store";
import { MagicSidebarDock } from "@/features/magic-sidebar/magic-sidebar-dock";
import { MagicSidebarProvider } from "@/features/magic-sidebar/magic-sidebar-store";
import { SymmioProvider } from "@symmio/trading-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useState } from "react";
import { WagmiProvider } from "wagmi";

const ThemeProvider = dynamic(() => import("next-themes").then((m) => m.ThemeProvider), {
  ssr: false,
});

/**
 * Feeds the runtime overrides store into `SymmioProvider` and wires the app's
 * wallet-client resolver (session key when it matches the requested signer, else
 * the wagmi-connected EOA — see {@link useAppGetWalletClient}).
 */
function SymmioConfigBridge({ children }: { children: ReactNode }) {
  const { overrides } = useSymmioOverrides();
  const getWalletClient = useAppGetWalletClient();

  return (
    <SymmioProvider chainOverrides={overrides} getWalletClient={getWalletClient}>
      <MagicSidebarProvider>
        <MagicPopoutProvider>
          <MagicSidebarDock>{children}</MagicSidebarDock>
        </MagicPopoutProvider>
      </MagicSidebarProvider>
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
