import { createConfig, fallback, http } from "wagmi";
import { arbitrum, base, hyperEvm } from "wagmi/chains";
import { injected, mock } from "wagmi/connectors";
import { E2E_ACCOUNT_ADDRESS, IS_E2E_MODE } from "./environment";

/**
 * Public HTTP RPC endpoint for HyperEVM main chain (id 999). Wrapped in
 * `fallback()` so we can add more upstreams without changing call sites —
 * single URL today, room to grow tomorrow.
 */
const HYPER_EVM_RPC_URLS = ["https://rpc.hyperliquid.xyz/evm", "https://hyperliquid.drpc.org"] as const;

/** Public HTTP RPC endpoints for Base main chain (id 8453). */
const BASE_RPC_URLS = ["https://mainnet.base.org", "https://base.drpc.org"] as const;

/** Public HTTP RPC endpoints shipped with viem's Arbitrum One chain definition. */
const ARBITRUM_RPC_URLS = arbitrum.rpcUrls.default.http;

export const wagmiConfig = createConfig({
  chains: [hyperEvm, base, arbitrum],
  /**
   * Per-chain transport. `fallback` lets us add backup RPCs without a code
   * change at call sites; per-URL `batch.wait` enables JSON-RPC batching for
   * bursty multicall reads. Every chain the SDK can read on must have a
   * transport here, or `getPublicClient({ chainId })` returns nothing and reads
   * silently no-op.
   */
  transports: {
    [hyperEvm.id]: fallback(HYPER_EVM_RPC_URLS.map((url) => http(url, { batch: { wait: 16 } }))),
    [base.id]: fallback(BASE_RPC_URLS.map((url) => http(url, { batch: { wait: 16 } }))),
    [arbitrum.id]: fallback(ARBITRUM_RPC_URLS.map((url) => http(url, { batch: { wait: 16 } }))),
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
