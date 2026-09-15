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
  /**
   * Also resolve the market's solver fee rates (`hedgerFeeOpen` /
   * `hedgerFeeClose`, decimal fraction strings). Same short-circuit contract as
   * `includeSolverFeeCaps`: pre-filled metadata skips the fetch only when both
   * rates are pre-filled too. The open wizard sets this — the solver charges
   * these fees from the VA, so the `addMargin` transfer must fund them.
   */
  includeHedgerFees?: boolean;
  /** Pre-fetched `hedgerFeeOpen` (decimal fraction string). */
  hedgerFeeOpen?: string;
  /** Pre-fetched `hedgerFeeClose` (decimal fraction string). */
  hedgerFeeClose?: string;
  /** Pre-fetched early (peak) close-fee rate (decimal fraction string). */
  hedgerFeeCloseEarlyRate?: string;
  /** Pre-fetched early-window length in seconds. */
  hedgerFeeCloseEarlyThreshold?: number;
  /** Pre-fetched standard-rate threshold in seconds. */
  hedgerFeeCloseStandardThreshold?: number;
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
  const { hedgerFeeOpen, hedgerFeeClose } = parameters;
  const { hedgerFeeCloseEarlyRate, hedgerFeeCloseEarlyThreshold, hedgerFeeCloseStandardThreshold } = parameters;
  const needCaps = parameters.includeSolverFeeCaps === true;
  const capsPrefilled = minOpenSolverFeeCap !== undefined && minCloseSolverFeeCap !== undefined;
  const needFees = parameters.includeHedgerFees === true;
  const feesPrefilled = hedgerFeeOpen !== undefined && hedgerFeeClose !== undefined;

  if (
    marketName !== undefined &&
    pricePrecision !== undefined &&
    quantityPrecision !== undefined &&
    (!needCaps || capsPrefilled) &&
    (!needFees || feesPrefilled)
  ) {
    return {
      name: marketName,
      pricePrecision,
      quantityPrecision,
      ...(needCaps ? { minOpenSolverFeeCap, minCloseSolverFeeCap } : {}),
      ...(needFees
        ? {
            hedgerFeeOpen,
            hedgerFeeClose,
            hedgerFeeCloseEarlyRate,
            hedgerFeeCloseEarlyThreshold,
            hedgerFeeCloseStandardThreshold,
          }
        : {}),
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
    ...(needFees
      ? {
          hedgerFeeOpen: hedgerFeeOpen ?? match.hedgerFeeOpen,
          hedgerFeeClose: hedgerFeeClose ?? match.hedgerFeeClose,
          // Early-close decay is Enigma-only; a non-Enigma market has no such fields.
          hedgerFeeCloseEarlyRate:
            hedgerFeeCloseEarlyRate ?? (match.kind === "enigma" ? match.hedgerFeeCloseEarlyRate : undefined),
          hedgerFeeCloseEarlyThreshold:
            hedgerFeeCloseEarlyThreshold ?? (match.kind === "enigma" ? match.hedgerFeeCloseEarlyThreshold : undefined),
          hedgerFeeCloseStandardThreshold:
            hedgerFeeCloseStandardThreshold ??
            (match.kind === "enigma" ? match.hedgerFeeCloseStandardThreshold : undefined),
        }
      : {}),
  };
}
