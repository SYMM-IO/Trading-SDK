/**
 * Parameters for {@link calculatePriceImpact}.
 */
export interface CalculatePriceImpactParameters {
  /** Estimated execution price (decimal string). */
  estimatedPrice: string;
  /** Reference price to measure the impact against (decimal string), e.g. the mark. */
  referencePrice: string;
}

/**
 * Signed **price-impact percent** of an estimated fill versus a reference price:
 * `(estimated − reference) / reference × 100`. Returns `0` when either input is
 * non-finite or the reference is `0`.
 *
 * The sign is direction-neutral (just the % difference); the UI interprets it by
 * side — for a **long open** a positive impact is worse (you fill above the
 * reference), for a **short open** a negative impact is worse.
 *
 * @example
 * ```ts
 * const impact = calculatePriceImpact({ estimatedPrice, referencePrice: markPrice }); // e.g. 0.42 → +0.42%
 * ```
 */
export function calculatePriceImpact(parameters: CalculatePriceImpactParameters): number {
  const estimated = Number(parameters.estimatedPrice);
  const reference = Number(parameters.referencePrice);
  if (!Number.isFinite(estimated) || !Number.isFinite(reference) || reference === 0) return 0;
  return ((estimated - reference) / reference) * 100;
}
