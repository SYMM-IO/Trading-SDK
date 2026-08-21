import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";

/**
 * The entire SYMMIO configuration Prism ships.
 *
 * Contract addresses, solver URLs, price services, notification channels, Muon
 * gateways and subgraphs all come from the SDK's built-in chain registry. The
 * only thing an integrator must supply is their own affiliate address per
 * chain — `createConfig` throws `AFFILIATE_ADDRESS_REQUIRED` without it.
 */
export const symmioChains: CreateConfigParameters["symmioConfig"] = {
  [SymmioSupportedChainId.BASE]: {
    addresses: { affiliatesAddress: "0x45Eecd7B4f442388ACD90467E423A5CAAC3a9C3f" },
  },
  [SymmioSupportedChainId.HYPER_EVM]: {
    addresses: { affiliatesAddress: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c" },
  },
};
