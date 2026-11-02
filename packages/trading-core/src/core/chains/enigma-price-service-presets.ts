import type { SymmioPriceServiceConfig } from "./types";

/** Parameters for {@link getEnigmaPriceServicePreset}. */
export interface GetEnigmaPriceServicePresetParameters {
  /** Enigma lowcap service deployment; independent of the wallet's chain. */
  environment: "production" | "staging";
}

/**
 * Return the REST and WebSocket endpoints for an Enigma lowcap deployment.
 *
 * This config helper performs no I/O. Each call returns a fresh object so
 * consumer overrides cannot mutate the registry or another consumer's preset.
 * It selects price services only; contracts and solver endpoints are unchanged.
 *
 * @param parameters - The service environment to select explicitly.
 * @returns A price-service block for chain or solver configuration.
 * @example
 * ```ts
 * const priceService = getEnigmaPriceServicePreset({ environment: "staging" });
 * // Pass the block to symmioConfig[chainId].priceService and, when needed,
 * // symmioConfig[chainId].solvers.enigma.priceService.
 * ```
 */
export function getEnigmaPriceServicePreset(
  parameters: GetEnigmaPriceServicePresetParameters,
): SymmioPriceServiceConfig {
  if (parameters.environment === "staging") {
    return {
      type: "enigma",
      url: "https://lowcap-price-staging.enigma.bz",
      wsUrl: "wss://lowcap-price.rasa.capital/ws",
    };
  }
  return {
    type: "enigma",
    url: "https://lowcap-price.enigma.bz",
    wsUrl: "wss://lowcap-price.enigma.bz/ws",
  };
}
