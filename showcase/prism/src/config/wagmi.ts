import { SymmioSupportedChainId } from "@symmio/trading-core";
import { createConfig, fallback, http, injected } from "wagmi";
import { arbitrum, base } from "wagmi/chains";

/**
 * wagmi config for Prism.
 *
 * Both chains carry a transport. That is what lets the app read majors and
 * lowcaps side by side without ever asking the wallet to switch: the SYMMIO
 * provider bridges `getClient` to `getPublicClient(wagmiConfig, { chainId })`,
 * so a read on either chain resolves regardless of where the wallet sits.
 * Wallet-paid writes still require the wallet on the target chain; relayed
 * session-key operations do not.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrum, base],
  connectors: [injected()],
  transports: {
    [SymmioSupportedChainId.ARBITRUM]: fallback(arbitrum.rpcUrls.default.http.map((url) => http(url))),
    [SymmioSupportedChainId.BASE]: fallback([http("https://mainnet.base.org"), http("https://base.drpc.org")]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
