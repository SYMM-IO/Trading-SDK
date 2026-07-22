import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";

/**
 * Per-chain SYMMIO config for the affiliate registration page. `SymmioProvider`
 * requires a non-zero `addresses.affiliatesAddress` on every supported chain —
 * this page does not trade, so the value only satisfies the provider; the
 * registration flow itself never reads it. Uses the built-in default affiliate
 * for HyperEVM (the same one baked into the chain registry).
 */
export const symmioChains: CreateConfigParameters["symmioConfig"] = {
  [SymmioSupportedChainId.HYPER_EVM]: {
    addresses: {
      affiliatesAddress: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
    },
  },
};
