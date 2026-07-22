import { createConfig, fallback, http } from "wagmi";
import { hyperEvm } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Public HTTP RPC endpoints for HyperEVM main chain. Wrapped in `fallback()` so
 * backups can be added without changing call sites. Mirrors `apps/web`.
 */
const HYPER_EVM_RPC_URLS = ["https://rpc.hyperliquid.xyz/evm", "https://hyperliquid.drpc.org"] as const;

/**
 * wagmi config for the landing site's single wallet-connected surface (the
 * affiliate registration page). HyperEVM only, `injected()` connector (MetaMask,
 * Rabby, any `window.ethereum` wallet). The rest of the marketing site stays
 * presentational and never mounts this.
 */
export const wagmiConfig = createConfig({
  chains: [hyperEvm],
  transports: {
    [hyperEvm.id]: fallback(HYPER_EVM_RPC_URLS.map((url) => http(url, { batch: { wait: 16 } }))),
  },
  connectors: [injected()],
  multiInjectedProviderDiscovery: true,
  ssr: true,
});
