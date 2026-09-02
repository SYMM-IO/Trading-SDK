/**
 * Market metadata resolved by {@link resolveMarket}.
 *
 * Lives in `solvers/shared/resolvers/` because both the instant-open and the
 * instant-close wizards depend on it. Move slice-specific types back into
 * their own slice's resolvers folder; only types shared by ≥2 slices belong
 * here.
 */
export interface ResolvedMarket {
  name: string;
  pricePrecision: number;
  quantityPrecision: number;
  /** Present when resolved with `includeSolverFeeCaps`. Decimal ratio string; `"0"` for kinds without caps. */
  minOpenSolverFeeCap?: string;
  /** Present when resolved with `includeSolverFeeCaps`. Decimal ratio string; `"0"` for kinds without caps. */
  minCloseSolverFeeCap?: string;
}
