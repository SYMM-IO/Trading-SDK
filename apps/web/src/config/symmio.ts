import { SymmioSupportedChainId, type CreateConfigParameters } from "@symm-frontier/core";

const VIBE_AFFILIATE_BY_CHAIN = {
  [SymmioSupportedChainId.HYPER_EVM]: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
} as const;

/**
 * Per-chain Symmio overrides for this app. Sets the VibeCaps affiliate address
 * for attribution; `SymmioProvider` deep-merges this onto the SDK's built-in
 * defaults.
 */
export const symmioChains: CreateConfigParameters["chainOverrides"] = {
  [SymmioSupportedChainId.HYPER_EVM]: {
    addresses: {
      affiliatesAddress: VIBE_AFFILIATE_BY_CHAIN[SymmioSupportedChainId.HYPER_EVM],
    },
  },
};
