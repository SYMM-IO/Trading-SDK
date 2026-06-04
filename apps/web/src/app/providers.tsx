"use client";

import { wagmiConfig } from "@/config/wagmi";
import { SymmioOverridesProvider, useSymmioOverrides } from "@/features/config/symmio-overrides-store";
import { SymmioProvider } from "@symm-frontier/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useState } from "react";
import { WagmiProvider } from "wagmi";

/**
 * Feeds the runtime overrides store into `SymmioProvider`, so editing config in
 * the panel rebuilds the SDK config and re-runs every dependent read/write.
 */
function SymmioConfigBridge({ children }: { children: ReactNode }) {
  const { overrides } = useSymmioOverrides();
  return <SymmioProvider chainOverrides={overrides}>{children}</SymmioProvider>;
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
