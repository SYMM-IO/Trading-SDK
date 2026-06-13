/**
 * Market metadata resolved by {@link resolveMarket}.
 */
export interface ResolvedMarket {
  name: string;
  pricePrecision: number;
  quantityPrecision: number;
}

/**
 * Solver locked-param percentages resolved by {@link resolveLockedParams}.
 */
export interface ResolvedLockedParams {
  cva: string;
  lf: string;
  partyAmm: string;
  partyBmm: string;
}
