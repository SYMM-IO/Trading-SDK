import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";

const AFFILIATE_BY_CHAIN = {
  [SymmioSupportedChainId.HYPER_EVM]: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c", // affiliate address
  [SymmioSupportedChainId.BASE]: "0x45Eecd7B4f442388ACD90467E423A5CAAC3a9C3f", // affiliate address
  [SymmioSupportedChainId.ARBITRUM]: "0xe99c18CF3C62B9229f9251fd2562077a33e7600a", // affiliate address
} as const;

/**
 * Per-chain SYMMIO config for this app — seeds the runtime overrides store and is
 * passed to `SymmioProvider`. Sets the affiliate (per chain) for attribution;
 * deep-merged onto the SDK's built-in defaults. Each chain configured HERE must
 * carry a non-zero `addresses.affiliatesAddress` or `createConfig` throws; a
 * supported chain left out falls back to its registry affiliate.
 */
export const symmioChains: CreateConfigParameters["symmioConfig"] = {
  [SymmioSupportedChainId.HYPER_EVM]: {
    addresses: {
      affiliatesAddress: AFFILIATE_BY_CHAIN[SymmioSupportedChainId.HYPER_EVM],
    },
  },
  [SymmioSupportedChainId.BASE]: {
    addresses: {
      affiliatesAddress: AFFILIATE_BY_CHAIN[SymmioSupportedChainId.BASE],
    },
  },
  [SymmioSupportedChainId.ARBITRUM]: {
    addresses: {
      affiliatesAddress: AFFILIATE_BY_CHAIN[SymmioSupportedChainId.ARBITRUM],
    },
    /**
     * Overrides no address: the registry's built-in Arbitrum block already is
     * this deployment, so restating its values would only fill the config panel
     * with overrides that equal their own defaults.
     *
     * Two fields the registry cannot supply:
     *
     * `url` — the registry points at the vendor origin, which a browser cannot
     * use: reaching it needs the gateway client key, and a key in the bundle is
     * a leaked key. `/api/gasless/staging` is this app's proxy, which injects
     * the key server-side. The path names its deployment so the proxy can
     * refuse a request meant for the other one.
     *
     * `execution.mode` — without it the dispatcher's `enabled` stays `false`
     * and every relayable write silently falls through to `writeContract`,
     * which is a dead end on a wallet holding no native token. `fallback` stays
     * at its default (`"error"`): a wallet fallback is worth having where the
     * user can actually pay gas, but here it would trade a precise relay error
     * for an out-of-gas one and hide why the relay was refused.
     *
     * Only `mode` and `fallback` belong under `execution` — the block is
     * JSON-persisted through the config overrides store, so a function
     * (`onEvent`) would not survive a reload.
     */
    gasless: {
      url: "/api/gasless/staging",
      protocolInstance: "arbitrum-42161-vibe",
      execution: { mode: "gasless" },
    },
  },
};
