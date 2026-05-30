"use client";

import { createSymmioClient, type SymmioClient } from "@symm-frontier/core";
import { useMemo, type ReactNode } from "react";
import type { Account, Chain, Transport, WalletClient } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import type { SymmioClientConfigInput } from "../config";
import { SymmioClientContext } from "./use-symmio-client";

/**
 * Props for {@link SymmioProvider}.
 */
export interface SymmioProviderProps {
  /**
   * SDK configuration the host app supplies. Defaults for the selected
   * chain come from core; explicit overrides win.
   */
  config: SymmioClientConfigInput;
  /** React subtree that may use SYMMIO SDK hooks. */
  children: ReactNode;
}

/**
 * Provides the SYMMIO client to descendant hooks.
 *
 * **Mount order matters**: this component reads wagmi context and (transitively)
 * the host's `@tanstack/react-query` `QueryClient`. Both must be mounted
 * **outside** `SymmioProvider`:
 *
 * ```tsx
 * <WagmiProvider config={wagmiConfig}>
 *   <QueryClientProvider client={queryClient}>
 *     <SymmioProvider config={symmioConfig}>
 *       <App />
 *     </SymmioProvider>
 *   </QueryClientProvider>
 * </WagmiProvider>
 * ```
 *
 * The SDK never mounts wagmi or a `QueryClient` for the host — that decision
 * (which connectors, which RPC URLs, which `QueryClient` instance shared with
 * the host's own queries) belongs to the host app.
 */
export function SymmioProvider({ config, children }: SymmioProviderProps) {
  const publicClient = usePublicClient({ chainId: config.chainId });
  const walletClientQuery = useWalletClient({ chainId: config.chainId });
  const walletClient = walletClientQuery.data as WalletClient<Transport, Chain, Account> | undefined;

  const client = useMemo<SymmioClient | undefined>(() => {
    if (!publicClient) return undefined;

    return createSymmioClient({
      chainId: config.chainId,
      publicClient,
      walletClient,
      overrides: {
        addresses: {
          ...config.addresses,
          affiliatesAddress: config.affiliateAddress,
        },
        subgraphs: config.subgraphs,
        solver: config.solver,
      },
    });
  }, [publicClient, walletClient, config]);

  return <SymmioClientContext.Provider value={client}>{children}</SymmioClientContext.Provider>;
}
