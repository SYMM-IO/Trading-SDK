import { SymmioSupportedChainId } from "@symmio/trading-core";
import { createConfig, fallback, http, injected } from "wagmi";
import { base, hyperEvm } from "wagmi/chains";

/**
 * wagmi config for Prism.
 *
 * Both chains carry a transport. That is what lets the app read majors and
 * lowcaps side by side without ever asking the wallet to switch: the SYMMIO
 * provider bridges `getClient` to `getPublicClient(wagmiConfig, { chainId })`,
 * so a read on either chain resolves regardless of where the wallet sits.
 * Writes still require the wallet on the target chain.
 */
export const wagmiConfig = createConfig({
  chains: [base, hyperEvm],
  connectors: [injected()],
  transports: {
    [SymmioSupportedChainId.BASE]: fallback([http("https://mainnet.base.org"), http("https://base.drpc.org")]),
    [SymmioSupportedChainId.HYPER_EVM]: fallback([
      http("https://rpc.hyperliquid.xyz/evm"),
      http("https://hyperliquid.drpc.org"),
    ]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
