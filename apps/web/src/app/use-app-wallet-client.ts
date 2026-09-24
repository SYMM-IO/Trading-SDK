"use client";

import { wagmiConfig } from "@/config/wagmi";
import { getAppSessionKeyManager } from "@/features/session-keys/session-key-manager";
import { createSessionKeyWalletClientResolver, type GetWalletClientFn } from "@symmio/trading-react";
import { useMemo } from "react";

/**
 * Builds the app's wallet-client resolver: when `from` matches the loaded
 * session key, sign in-memory with the session-key account; otherwise fall back
 * to the wagmi-connected EOA.
 *
 * The resolver comes from `@symmio/trading-react` rather than being hand-rolled
 * here. Two things the app used to get wrong come for free: the raw private key
 * is never materialized (the manager hands over a `LocalAccount` signer), and
 * the session-key client is bound to the transport wagmi already configured for
 * that chain — the app's own RPCs in `@/config/wagmi` — instead of a bare
 * `http()` that silently falls back to viem's public defaults.
 *
 * Extracted from the provider tree so a popped-out method window can re-supply
 * `SymmioProvider` in its own React root with the same signer behavior.
 *
 * @returns The resolver to pass as `SymmioProvider`'s `getWalletClient` prop.
 */
export function useAppGetWalletClient(): GetWalletClientFn {
  return useMemo(
    () =>
      createSessionKeyWalletClientResolver({
        wagmiConfig,
        /**
         * Read through the manager on every call rather than closing over an
         * account, so initializing, rotating, importing, or destroying the key
         * takes effect without rebuilding the resolver.
         */
        getSessionAccount: () => getAppSessionKeyManager().getAccount(),
      }),
    [],
  );
}
