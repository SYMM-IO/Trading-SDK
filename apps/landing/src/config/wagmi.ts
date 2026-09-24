import { createConfig, fallback, http } from "wagmi";
import { arbitrum } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Public HTTP RPC endpoints for Arbitrum main chain. Wrapped in `fallback()` so
 * backups can be added without changing call sites. Mirrors `apps/web`.
 */
const ARBITRUM_RPC_URLS = arbitrum.rpcUrls.default.http;

/**
 * wagmi config for the landing site's single wallet-connected surface (the
 * affiliate registration page). Arbitrum only, `injected()` connector (MetaMask,
 * Rabby, any `window.ethereum` wallet). The rest of the marketing site stays
 * presentational and never mounts this.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: {
    [arbitrum.id]: fallback(ARBITRUM_RPC_URLS.map((url) => http(url, { batch: { wait: 16 } }))),
  },
  connectors: [injected()],
  multiInjectedProviderDiscovery: true,
  ssr: true,
});
