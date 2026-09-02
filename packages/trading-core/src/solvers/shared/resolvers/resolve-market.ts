import type { SolverId } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { getMarkets } from "../../markets/get-markets";
import type { ResolvedMarket } from "./types";

/**
 * Parameters for {@link resolveMarket}.
 */
export interface ResolveMarketParameters {
  chainId?: number;
  /**
   * Solver whose `/contract-symbols` listing to read. **Must match the solver
   * the trade is sent to** — the resolved `name` and precisions are encoded into
   * the signed quote. Defaults to the chain's `defaultSolverId`.
   */
  solverId?: SolverId;
  marketId: number;
  marketName?: string;
  pricePrecision?: number;
  quantityPrecision?: number;
  /**
   * Also resolve the market's solver-fee caps (`minOpenSolverFeeCap` /
   * `minCloseSolverFeeCap`, decimal ratio strings). With this set, pre-filled
   * metadata short-circuits the fetch only when both caps are pre-filled too;
   * a fetched market that carries no caps (a non-Enigma kind) resolves both to
   * `"0"`. The open wizard sets this; the close wizard does not need caps.
   */
  includeSolverFeeCaps?: boolean;
  /** Pre-fetched `minOpenSolverFeeCap` (decimal ratio string). */
  minOpenSolverFeeCap?: string;
  /** Pre-fetched `minCloseSolverFeeCap` (decimal ratio string). */
  minCloseSolverFeeCap?: string;
}

/**
 * Resolve market metadata (`name`, `pricePrecision`, `quantityPrecision`, and —
 * when `includeSolverFeeCaps` is set — the solver-fee cap minimums) for
 * `marketId`. Returns caller-supplied values when everything needed is
 * pre-filled; otherwise fetches `/contract-symbols` and extracts the matching
 * record. The normalized {@link Market} shape guarantees the metadata fields,
 * so only "not found" can fail here.
 *
 * Shared by the instant-open and instant-close wizards.
 *
 * @throws {SymmError} `RESOLVE_MARKET_NOT_FOUND` when no record matches.
 */
export async function resolveMarket(config: Config, parameters: ResolveMarketParameters): Promise<ResolvedMarket> {
  const { marketName, pricePrecision, quantityPrecision, minOpenSolverFeeCap, minCloseSolverFeeCap } = parameters;
  const needCaps = parameters.includeSolverFeeCaps === true;
  const capsPrefilled = minOpenSolverFeeCap !== undefined && minCloseSolverFeeCap !== undefined;

  if (
    marketName !== undefined &&
    pricePrecision !== undefined &&
    quantityPrecision !== undefined &&
    (!needCaps || capsPrefilled)
  ) {
    return {
      name: marketName,
      pricePrecision,
      quantityPrecision,
      ...(needCaps ? { minOpenSolverFeeCap, minCloseSolverFeeCap } : {}),
    };
  }

  const markets = await getMarkets(config, { chainId: parameters.chainId, solverId: parameters.solverId });
  const match = markets.find((m) => m.symbolId === parameters.marketId);
  if (!match) {
    throw new SymmError(
      "api",
      "RESOLVE_MARKET_NOT_FOUND",
      `Market id ${parameters.marketId} not returned by solver /contract-symbols.`,
    );
  }

  return {
    name: marketName ?? match.name,
    pricePrecision: pricePrecision ?? match.pricePrecision,
    quantityPrecision: quantityPrecision ?? match.quantityPrecision,
    ...(needCaps
      ? {
          minOpenSolverFeeCap: minOpenSolverFeeCap ?? (match.kind === "enigma" ? match.minOpenSolverFeeCap : "0"),
          minCloseSolverFeeCap: minCloseSolverFeeCap ?? (match.kind === "enigma" ? match.minCloseSolverFeeCap : "0"),
        }
      : {}),
  };
}
