import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";

/**
 * Per-chain SYMMIO config for the affiliate registration page. `SymmioProvider`
 * requires a non-zero `addresses.affiliatesAddress` on every supported chain —
 * this page does not trade, so the value only satisfies the provider; the
 * registration flow itself never reads it. Uses the built-in default affiliate
 * for Arbitrum (the same one baked into the chain registry).
 */
export const symmioChains: CreateConfigParameters["symmioConfig"] = {
  [SymmioSupportedChainId.ARBITRUM]: {
    addresses: {
      affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D",
    },
  },
};
