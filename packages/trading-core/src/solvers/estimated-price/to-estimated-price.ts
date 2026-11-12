import type { ApiGetEstimatedPriceResponse } from "../types/generated/enigma-solver";
import type { GetEstimatedPriceReturnType } from "./get-estimated-price";

/**
 * Map the generated `ApiGetEstimatedPriceResponse` into the SDK's
 * {@link GetEstimatedPriceReturnType}. A missing / empty `price` defaults to
 * `"0"`. The optional no-shadow price is diagnostic data and is never invented
 * or substituted for the execution price.
 */
export function toEstimatedPrice(raw: ApiGetEstimatedPriceResponse): GetEstimatedPriceReturnType {
  return {
    estimatedPrice: typeof raw.price === "string" && raw.price.length > 0 ? raw.price : "0",
    ...(typeof raw.price_without_shadow === "string" && raw.price_without_shadow.length > 0
      ? { estimatedPriceWithoutShadow: raw.price_without_shadow }
      : {}),
  };
}
