import { createConfig, fallback, http } from "wagmi";
import { arbitrum, base } from "wagmi/chains";
import { injected, mock } from "wagmi/connectors";
import { ARBITRUM_RPC_URL_OVERRIDE, E2E_ACCOUNT_ADDRESS, IS_E2E_MODE, mockerConfig } from "./environment";

/** Public HTTP RPC endpoints for Base main chain (id 8453). */
const BASE_RPC_URLS = ["https://mainnet.base.org", "https://base.drpc.org"] as const;

const ARBITRUM_RPC_URL = mockerConfig?.rpcUrl ?? ARBITRUM_RPC_URL_OVERRIDE;

/**
 * Arbitrum chain definition. With an RPC override, it replaces the first default
 * RPC URL on the chain itself, not only on the transport: the wagmi `mock`
 * connector sends through the chain definition's default URL and ignores the
 * transport. Without one, this is viem's `arbitrum` unchanged.
 */
const arbitrumChain = ARBITRUM_RPC_URL
  ? { ...arbitrum, rpcUrls: { ...arbitrum.rpcUrls, default: { http: [ARBITRUM_RPC_URL] as const } } }
  : arbitrum;

export const wagmiConfig = createConfig({
  chains: [arbitrumChain, base],
  /**
   * Per-chain transport. `fallback` lets us add backup RPCs without a code
   * change at call sites; per-URL `batch.wait` enables JSON-RPC batching for
   * bursty multicall reads. Every chain the SDK can read on must have a
   * transport here, or `getPublicClient({ chainId })` returns nothing and reads
   * silently no-op.
   */
  transports: {
    [arbitrumChain.id]: fallback(arbitrumChain.rpcUrls.default.http.map((url) => http(url, { batch: { wait: 16 } }))),
    [base.id]: fallback(BASE_RPC_URLS.map((url) => http(url, { batch: { wait: 16 } }))),
  },
  /**
   * `injected()` covers MetaMask, Rabby, and any other window.ethereum wallet.
   * Production builds use injected; E2E builds swap in the mock connector
   * bound to the well-known test address (see `environment.ts` for details
   * on why we don't ship the signing key to the browser).
   */
  connectors: IS_E2E_MODE ? [mock({ accounts: [E2E_ACCOUNT_ADDRESS] })] : [injected()],
  multiInjectedProviderDiscovery: !IS_E2E_MODE,
  ssr: true,
});
