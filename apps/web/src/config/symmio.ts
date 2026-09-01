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
  },
};
