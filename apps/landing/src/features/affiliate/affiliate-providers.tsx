"use client";

import { symmioChains } from "@/config/symmio";
import { wagmiConfig } from "@/config/wagmi";
import { SymmioProvider } from "@symmio/trading-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

/**
 * SDK runtime providers, scoped to the affiliate registration route only. The
 * rest of the landing site stays presentational and never mounts wagmi — this
 * keeps the marketing home lean and confines the wallet stack to the one page
 * that signs a transaction.
 *
 * Mount order mirrors `apps/web`: `WagmiProvider` → `QueryClientProvider` →
 * `SymmioProvider`. No custom `getWalletClient` is passed, so the SDK signs with
 * the wagmi-connected wallet (there are no session keys here).
 */
export function AffiliateProviders({ children }: { children: ReactNode }) {
  /**
   * One `QueryClient` per browser session, created lazily so Next's SSR pass and
   * the client hydration share a single instance.
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 2, staleTime: 30_000 },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SymmioProvider symmioConfig={symmioChains}>{children}</SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
