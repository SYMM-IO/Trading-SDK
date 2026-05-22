"use client";

import { createContext, type ReactNode } from "react";
import { resolveSymmioConfig, type SymmioClientConfig, type SymmioClientConfigInput } from "../config";

/**
 * React context used by every SYMMIO SDK hook to read the resolved
 * configuration. Exposed for tests and host-side composition; production code
 * should prefer `useSymmioConfig`.
 *
 * @internal
 */
export const SymmioConfigContext = createContext<SymmioClientConfig | null>(null);

/**
 * Props for {@link SymmioProvider}.
 */
export interface SymmioProviderProps {
  /**
   * SDK configuration the host app supplies. Defaults for the selected
   * `environment` + `chainId` are merged in by `resolveSymmioConfig`; explicit
   * overrides win.
   */
  config: SymmioClientConfigInput;
  /** React subtree that may use SYMMIO SDK hooks. */
  children: ReactNode;
}

/**
 * Provides resolved SYMMIO SDK configuration to descendant hooks.
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
  const resolved = resolveSymmioConfig(config);
  return <SymmioConfigContext.Provider value={resolved}>{children}</SymmioConfigContext.Provider>;
}
