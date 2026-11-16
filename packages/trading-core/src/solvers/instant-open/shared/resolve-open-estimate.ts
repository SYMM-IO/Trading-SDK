import type { Config } from "../../../core/config";
import { fetchOpenEstimatePrice, type FetchOpenEstimatePriceParameters } from "./open-estimate-guard";
import { assertUsableOpenReferencePrice, toUsableOpenPrice } from "./open-price";
import type { InstantOpenEstimateMetadata } from "./types";

/**
 * Resolve the same estimate state for preparation and fee previews without replacing the reference price.
 *
 * @param config - The SDK config.
 * @param parameters - The parameters for the open estimate.
 * @returns The open estimate metadata.
 */
export async function resolveOpenEstimate(
  config: Config,
  parameters: FetchOpenEstimatePriceParameters & { isLowcap: boolean; estimatedOpenPrice?: string | null },
): Promise<InstantOpenEstimateMetadata> {
  assertUsableOpenReferencePrice(parameters.markPrice);
  if (!parameters.isLowcap) return { openEstimateStatus: "unsupported", estimatedOpenPrice: null };
  const price = toUsableOpenPrice(
    parameters.estimatedOpenPrice === undefined
      ? await fetchOpenEstimatePrice(config, parameters)
      : parameters.estimatedOpenPrice,
  );
  return price === undefined
    ? { openEstimateStatus: "unavailable", estimatedOpenPrice: null }
    : { openEstimateStatus: "available", estimatedOpenPrice: price };
}
