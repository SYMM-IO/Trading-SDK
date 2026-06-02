"use client";

import { symmioChains } from "@/config/symmio";
import { wagmiConfig } from "@/config/wagmi";
import { SymmioProvider } from "@symm-frontier/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useState } from "react";
import { WagmiProvider } from "wagmi";

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
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SymmioProvider chainOverrides={symmioChains}>{children}</SymmioProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
