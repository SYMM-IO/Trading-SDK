import { SymmError } from "../../../shared/errors/symm-error";
import { decimalPriceToWei } from "../../../shared/utils/price";

/** Keep exact decimal prices only when they remain positive in contract units. */
export function toUsableOpenPrice(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const price = decimalPriceToWei(value);
  return price !== undefined && price > 0n ? value : undefined;
}

/** An open always needs a usable reference, including when its estimate succeeds. */
export function assertUsableOpenReferencePrice(value: string): void {
  if (toUsableOpenPrice(value) === undefined) {
    throw new SymmError(
      "validation",
      "OPEN_PRICE_UNAVAILABLE",
      "No positive, finite reference price is available for this order.",
    );
  }
}
