import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";

const AFFILIATE_BY_CHAIN = {
  [SymmioSupportedChainId.BASE]: "0x45Eecd7B4f442388ACD90467E423A5CAAC3a9C3f", // affiliate address
  [SymmioSupportedChainId.ARBITRUM]: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D", // affiliate address
} as const;

/**
 * Per-chain SYMMIO config for this app — seeds the runtime overrides store and is
 * passed to `SymmioProvider`. Sets the affiliate (per chain) for attribution;
 * deep-merged onto the SDK's built-in defaults. Each chain configured HERE must
 * carry a non-zero `addresses.affiliatesAddress` or `createConfig` throws; a
 * supported chain left out falls back to its registry affiliate.
 */
export const symmioChains: CreateConfigParameters["symmioConfig"] = {
  [SymmioSupportedChainId.BASE]: {
    addresses: {
      affiliatesAddress: AFFILIATE_BY_CHAIN[SymmioSupportedChainId.BASE],
    },
  },
  [SymmioSupportedChainId.ARBITRUM]: {
    addresses: {
      affiliatesAddress: AFFILIATE_BY_CHAIN[SymmioSupportedChainId.ARBITRUM],
    },
  },
};
