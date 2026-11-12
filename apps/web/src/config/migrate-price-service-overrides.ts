import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";
import { STAGING_CHAIN_OVERRIDES } from "./symmio-presets";

/** Upgrade only the retired staging price endpoint, preserving deliberate custom settings. */
export function migratePriceServiceOverrides(overrides: CreateConfigParameters["symmioConfig"]) {
  const chainId = SymmioSupportedChainId.ARBITRUM;
  const chain = overrides?.[chainId];
  const staging = STAGING_CHAIN_OVERRIDES[chainId];
  if (
    chain?.addresses?.instantLayerAddress?.toLowerCase() !== staging.addresses.instantLayerAddress.toLowerCase() ||
    chain.priceService?.type !== staging.priceService.type ||
    chain.priceService.url !== staging.priceService.url ||
    chain.priceService.wsUrl !== "wss://lowcap-price.rasa.capital/ws"
  )
    return overrides;

  return {
    ...overrides,
    [chainId]: { ...chain, priceService: { ...chain.priceService, wsUrl: staging.priceService.wsUrl } },
  };
}
