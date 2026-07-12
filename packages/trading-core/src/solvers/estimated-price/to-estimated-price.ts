import type { ApiGetEstimatedPriceResponse } from "../types/generated/enigma-solver";
import type { GetEstimatedPriceReturnType } from "./get-estimated-price";

/**
 * Map the generated `ApiGetEstimatedPriceResponse` into the SDK's
 * {@link GetEstimatedPriceReturnType}. A missing / empty `price` defaults to
 * `"0"`.
 */
export function toEstimatedPrice(raw: ApiGetEstimatedPriceResponse): GetEstimatedPriceReturnType {
  return { estimatedPrice: typeof raw.price === "string" && raw.price.length > 0 ? raw.price : "0" };
}
