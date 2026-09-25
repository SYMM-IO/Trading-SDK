import { createConfig, SymmioSupportedChainId, type Config, type CreateConfigParameters } from "@symmio/trading-core";
import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { walletHub } from "../wallet/wallet-hub.js";
import { DEPLOYMENTS } from "./deployments.js";
import { getAffiliateAddress, getRpcUrl, type SdkEnvironment } from "./environment.js";
import { STAGING_CHAIN_OVERRIDES } from "./staging.js";

let cached: { environment: SdkEnvironment; config: Config } | undefined;

/**
 * The terminal's canonical `@symmio/trading-core` config. It is fully headless:
 * reads go through one viem `PublicClient` (HTTP JSON-RPC batching on for the VA
 * fan-out), writes resolve through {@link walletHub}, and the per-chain
 * affiliate override routes every quote's fee share. Switching environment
 * replaces this instance; every action and query-options factory receives the
 * same active config.
 */
export function getConfig(environment: SdkEnvironment): Config {
  if (cached?.environment === environment) return cached.config;

  const clients = new Map<number, PublicClient>();
  const symmioConfig: NonNullable<CreateConfigParameters["symmioConfig"]> = {};

  for (const deployment of DEPLOYMENTS) {
    const primary = getRpcUrl(deployment.chainId);
    const urls = [primary, ...deployment.rpcUrls.filter((url) => url !== primary)];
    const client = createPublicClient({
      chain: deployment.chain,
      transport: fallback(urls.map((url) => http(url, { batch: { wait: 16 } }))),
    });
    clients.set(deployment.chainId, client as PublicClient);
    const stagingOverride =
      environment === "staging" && deployment.chainId === SymmioSupportedChainId.ARBITRUM
        ? STAGING_CHAIN_OVERRIDES[SymmioSupportedChainId.ARBITRUM]
        : undefined;
    symmioConfig[deployment.chainId] = stagingOverride
      ? {
          ...stagingOverride,
          addresses: {
            ...stagingOverride.addresses,
            affiliatesAddress: getAffiliateAddress(deployment.chainId, stagingOverride.addresses?.affiliatesAddress),
          },
        }
      : { addresses: { affiliatesAddress: getAffiliateAddress(deployment.chainId) } };
  }

  const config = createConfig({
    symmioConfig,
    getClient: ({ chainId } = {}) => {
      const client = clients.get(chainId ?? DEPLOYMENTS[0]!.chainId);
      if (!client) throw new Error(`No public client configured for chain ${chainId}.`);
      return client;
    },
    getWalletClient: walletHub.getWalletClient,
    defaultChainId: DEPLOYMENTS[0]!.chainId,
  });

  cached = { environment, config };
  return config;
}
