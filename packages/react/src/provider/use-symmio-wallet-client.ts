"use client";

import { useWalletClient, type UseWalletClientReturnType } from "wagmi";
import { useSymmioConfig } from "./use-symmio-config";

/**
 * Resolve a viem `WalletClient` for the SDK's configured chain, using the
 * host's wagmi config. The return shape mirrors wagmi's `useWalletClient` —
 * including `data`, `status`, and `error` — so loading and disconnected states
 * are surfaced uniformly.
 *
 * `data` is `undefined` until the user connects a wallet *and* the wallet is
 * actually switched to the SDK's configured chain.
 *
 * @internal — consumed by write hooks like `useEditAccountName`.
 */
export function useSymmioWalletClient(): UseWalletClientReturnType {
  const config = useSymmioConfig();
  return useWalletClient({ chainId: config.chainId });
}
