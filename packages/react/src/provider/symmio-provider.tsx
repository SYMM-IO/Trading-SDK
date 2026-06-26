"use client";

import {
  createConfig,
  SymmError,
  type Config,
  type CreateConfigParameters,
  type GetWalletClientFn,
} from "@theoldvarorg/core";
import { useMemo, type ReactNode } from "react";
import type { PublicClient } from "viem";
import { useConfig } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import { SymmioConfigContext } from "./symmio-config-context";

/**
 * Props for {@link SymmioProvider}.
 */
export interface SymmioProviderProps {
  /** React subtree that may use SYMMIO SDK hooks. */
  children: ReactNode;
  /**
   * Per-chain Symmio overrides (addresses, subgraphs, solver) deep-merged onto
   * the SDK's built-in defaults, keyed by chain id. Omit to use defaults.
   */
  chainOverrides?: CreateConfigParameters["chainOverrides"];
  /** Chain used when a hook or action omits `chainId`. Defaults to the first supported chain. */
  defaultChainId?: number;
  /**
   * Custom wallet-client resolver. Receives `{ chainId, from? }` from the SDK
   * and returns the wallet client to sign with. Use this to plug in
   * session-key, multi-signer, or any non-wagmi flow — the resolver decides.
   *
   * When omitted, the provider falls back to wagmi's connected wallet (ignores
   * `from`).
   */
  getWalletClient?: GetWalletClientFn;
}

/**
 * Provides the SYMMIO {@link Config} to descendant hooks. The config's viem
 * clients are resolved from the host's wagmi config, so this is the only place
 * the SDK touches wagmi.
 *
 * **Mount order matters**: this reads wagmi context and (transitively) the
 * host's `@tanstack/react-query` `QueryClient`. Both must be mounted **outside**
 * `SymmioProvider`:
 *
 * ```tsx
 * <WagmiProvider config={wagmiConfig}>
 *   <QueryClientProvider client={queryClient}>
 *     <SymmioProvider>
 *       <App />
 *     </SymmioProvider>
 *   </QueryClientProvider>
 * </WagmiProvider>
 * ```
 *
 * The SDK never mounts wagmi or a `QueryClient` for the host — those (which
 * connectors, which RPC URLs, which shared `QueryClient`) belong to the host.
 */
export function SymmioProvider({
  children,
  chainOverrides,
  defaultChainId,
  getWalletClient: getWalletClientProp,
}: SymmioProviderProps) {
  const wagmiConfig = useConfig();

  const config = useMemo<Config>(
    () =>
      createConfig({
        chainOverrides,
        defaultChainId,
        getClient: ({ chainId } = {}): PublicClient => {
          const client = getPublicClient(wagmiConfig, { chainId });

          if (!client)
            throw new SymmError(
              "config",
              "NO_PUBLIC_CLIENT",
              `No public client available for chain ${chainId ?? "(default)"}.`,
            );
          return client;
        },
        getWalletClient:
          getWalletClientProp ??
          (async ({ chainId }) => {
            try {
              return await getWalletClient(wagmiConfig, { chainId });
            } catch (err) {
              throw new SymmError(
                "config",
                "NO_WALLET_CONNECTED",
                "No connected wallet. Connect a wallet before sending transactions.",
                { cause: err instanceof Error ? err : undefined },
              );
            }
          }),
      }),
    [chainOverrides, defaultChainId, getWalletClientProp, wagmiConfig],
  );

  return <SymmioConfigContext.Provider value={config}>{children}</SymmioConfigContext.Provider>;
}
