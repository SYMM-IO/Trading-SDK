/**
 * Solver locked-param percentages resolved by {@link resolveLockedParams}.
 *
 * Open-specific. `ResolvedMarket` moved up to
 * `solvers/shared/resolvers/types.ts` because both the open and close wizards
 * use it.
 */
export interface ResolvedLockedParams {
  cva: string;
  lf: string;
  partyAmm: string;
  partyBmm: string;
}
