import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";

const FRONTIER_AFFILIATE_BY_CHAIN = {
  [SymmioSupportedChainId.HYPER_EVM]: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c", // Frontier Affiliate Address
} as const;

/**
 * Per-chain SYMMIO config for this app — seeds the runtime overrides store and is
 * passed to `SymmioProvider`. Sets the Frontier affiliate (per chain) for
 * attribution; deep-merged onto the SDK's built-in defaults. Each supported chain
 * must carry a non-zero `addresses.affiliatesAddress` or `createConfig` throws.
 */
export const symmioChains: CreateConfigParameters["symmioConfig"] = {
  [SymmioSupportedChainId.HYPER_EVM]: {
    addresses: {
      affiliatesAddress: FRONTIER_AFFILIATE_BY_CHAIN[SymmioSupportedChainId.HYPER_EVM],
    },
  },
};
