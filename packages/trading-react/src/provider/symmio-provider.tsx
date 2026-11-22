"use client";

import {
  createConfig,
  listSupportedChains,
  SymmError,
  type Config,
  type CreateConfigParameters,
  type GetClientFn,
  type GetWalletClientFn,
  type SymmioWalletClient,
} from "@symmio/trading-core";
import { useMemo, type ReactNode } from "react";
import type { PublicClient } from "viem";
import { useChainId, useConfig } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import { SymmioChainIdContext } from "./symmio-chain-id-context";
import { SymmioConfigContext } from "./symmio-config-context";

/**
 * Props for {@link SymmioProvider}.
 */
export interface SymmioProviderProps {
  /** React subtree that may use SYMMIO SDK hooks. */
  children: ReactNode;
  /**
   * Per-chain SYMMIO configuration, keyed by chain id — deep-merged onto the
   * SDK's built-in defaults (addresses, subgraphs, solver, …).
   *
   * **Required.** Every supported chain must set a non-zero
   * `addresses.affiliatesAddress` — your frontend's on-chain affiliate (your
   * identity in SYMMIO on that chain), attached to every quote so the protocol
   * attributes the trade to you and routes your fee share. Affiliate addresses
   * are per chain (a registration on one chain is not valid on another). The
   * provider throws `AFFILIATE_ADDRESS_REQUIRED` (via `createConfig`) for any
   * supported chain missing it, so trades can never silently fall back to the
   * built-in default affiliate and lose attribution.
   */
  symmioConfig: CreateConfigParameters["symmioConfig"];
  /**
   * Fallback for `config.defaultChainId` (a no-arg `config.getChainConfig()`
   * and any core action that omits `chainId`) when wagmi's active chain is not
   * a supported SYMMIO chain. When it *is* supported, that chain becomes the
   * default instead. Disconnecting does not trigger the fallback: wagmi keeps
   * its last active chain. Hooks do not use it either — without a pinned
   * `chainId`, {@link useSymmioChainId} returns wagmi's active chain as is.
   * Defaults to the SDK's first supported chain. Ignored when `chainId` is set.
   */
  defaultChainId?: number;
  /**
   * Pin every SDK default to this chain, whatever chain the connected wallet is
   * on. When set, `config.defaultChainId`, a no-arg `config.getChainConfig()`
   * and {@link useSymmioChainId} all resolve to this chain, and
   * `defaultChainId` is ignored. A hook or action's explicit `chainId` still
   * wins.
   *
   * Use it for an app that serves one chain: without it, a wallet on another
   * supported chain moves the SDK default there, and writes that omit `chainId`
   * target that chain. Switching the wallet to the pinned chain stays the
   * host's job. Omit it to keep following the connected wallet.
   *
   * @example
   * ```tsx
   * <SymmioProvider symmioConfig={symmioConfig} chainId={SymmioSupportedChainId.ARBITRUM}>
   *   {children}
   * </SymmioProvider>;
   * ```
   */
  chainId?: number;
  /**
   * Custom read-client resolver. Receives `{ chainId? }` from the SDK and
   * returns the viem `PublicClient` that every on-chain SDK read — and every
   * write's dry-run and receipt wait — runs on. Use it when the app reads
   * through its own client (a dedicated RPC URL, request batching, an
   * instrumented transport) rather than wagmi's transport for that chain.
   *
   * Return a client bound to the requested `chainId`, or throw for a chain the
   * app does not serve — never a client for another chain, which would read
   * the wrong contracts without any error.
   *
   * When omitted, the provider reads through wagmi's public client for the
   * requested chain. Memoize the resolver: a new function identity rebuilds
   * the SDK config, which resets every per-config cache (nonce locks, relay
   * request registry, stream connections).
   *
   * @example
   * ```tsx
   * const getClient = useCallback(() => appPublicClient, []);
   *
   * <SymmioProvider symmioConfig={symmioConfig} getClient={getClient}>
   *   {children}
   * </SymmioProvider>;
   * ```
   */
  getClient?: GetClientFn;
  /**
   * Custom wallet-client resolver. Receives `{ chainId, from? }` from the SDK
   * and returns the wallet client to sign with. Use this to plug in
   * session-key, multi-signer, or any non-wagmi flow — the resolver decides.
   * {@link createSessionKeyWalletClientResolver} builds the session-key one.
   *
   * When omitted, the provider signs with wagmi's connected wallet. That default
   * can only honor a `from` that *is* the connected account: any other `from`
   * (a session key, another signer) throws `SESSION_SIGNER_UNAVAILABLE` rather
   * than silently prompting the connected wallet instead — the owner is also
   * authorized on-chain, so such a write would otherwise succeed with the wrong
   * signer and no way to notice.
   */
  getWalletClient?: GetWalletClientFn;
}

/**
 * Provides the SYMMIO {@link Config} to descendant hooks. The config's viem
 * clients are resolved from the host's wagmi config unless the host passes its
 * own `getClient` / `getWalletClient` resolver, so this is the only place the
 * SDK touches wagmi.
 *
 * **Mount order matters**: this reads wagmi context and (transitively) the
 * host's `@tanstack/react-query` `QueryClient`. Both must be mounted **outside**
 * `SymmioProvider`:
 *
 * ```tsx
 * <WagmiProvider config={wagmiConfig}>
 *   <QueryClientProvider client={queryClient}>
 *     <SymmioProvider symmioConfig={{ [SymmioSupportedChainId.ARBITRUM]: { addresses: { affiliatesAddress: "0x…" } } }}>
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
  symmioConfig,
  defaultChainId,
  chainId: pinnedChainId,
  getClient: getClientProp,
  getWalletClient: getWalletClientProp,
}: SymmioProviderProps) {
  const wagmiConfig = useConfig();
  const connectedChainId = useChainId();

  // Track wagmi's active chain as the config default whenever it is a supported
  // SYMMIO chain, so a no-arg `config.getChainConfig()` resolves to the ACTIVE
  // chain rather than a hardcoded first chain. Single fix for the whole class
  // of "reads the wrong chain's addresses after switching". Falls back to the
  // explicit `defaultChainId` prop (then the SDK's first supported chain) when
  // wagmi's active chain is unsupported. wagmi keeps its last chain after a
  // disconnect, so disconnecting alone does not trigger the fallback. A pinned
  // `chainId` overrides all of this.
  const effectiveDefaultChainId =
    pinnedChainId ?? (listSupportedChains().some((id) => id === connectedChainId) ? connectedChainId : defaultChainId);

  const config = useMemo<Config>(
    () =>
      createConfig({
        symmioConfig,
        defaultChainId: effectiveDefaultChainId,
        getClient:
          getClientProp ??
          (({ chainId } = {}): PublicClient => {
            const client = getPublicClient(wagmiConfig, { chainId });

            if (!client)
              throw new SymmError(
                "config",
                "NO_PUBLIC_CLIENT",
                `No public client available for chain ${chainId ?? "(default)"}.`,
              );
            return client;
          }),
        getWalletClient:
          getWalletClientProp ??
          (async ({ chainId, from }) => {
            let walletClient: SymmioWalletClient;

            try {
              walletClient = await getWalletClient(wagmiConfig, { chainId });
            } catch (err) {
              throw new SymmError(
                "config",
                "NO_WALLET_CONNECTED",
                "No connected wallet. Connect a wallet before sending transactions.",
                { cause: err instanceof Error ? err : undefined },
              );
            }

            /**
             * `from` is never forwarded to wagmi as `account` — a session key is
             * not a wagmi-connected account, so wagmi would reject it or
             * mis-resolve it. Instead the resolved signer is checked against the
             * request. Dropping a `from` it cannot honor would be silent: the
             * account owner is authorized on-chain for the same calls, so the
             * write succeeds after an unexpected wallet prompt and nothing looks
             * broken.
             */
            if (from && from.toLowerCase() !== walletClient.account.address.toLowerCase())
              throw new SymmError(
                "config",
                "SESSION_SIGNER_UNAVAILABLE",
                `This action asked to sign as ${from}, but the default wallet-client resolver can only sign with the wagmi-connected wallet (${walletClient.account.address}). Pass SymmioProvider a \`getWalletClient\` built by \`createSessionKeyWalletClientResolver\` to route session-key signers.`,
              );

            return walletClient;
          }),
      }),
    [symmioConfig, effectiveDefaultChainId, getClientProp, getWalletClientProp, wagmiConfig],
  );

  return (
    <SymmioConfigContext.Provider value={config}>
      <SymmioChainIdContext.Provider value={pinnedChainId}>{children}</SymmioChainIdContext.Provider>
    </SymmioConfigContext.Provider>
  );
}
