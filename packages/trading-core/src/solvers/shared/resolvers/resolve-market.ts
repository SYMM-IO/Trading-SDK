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
  /**
   * Also resolve the market's quote-constraint fields (lot size, notional
   * bounds, quote-value floors). Same short-circuit contract as the other
   * include flags: pre-filled metadata skips the fetch only when **all six**
   * constraint fields are pre-filled too. The full-balance open sizing sets
   * this — the SDK-computed quantity must land on the lot grid and clear the
   * published floors before it is signed.
   */
  includeQuoteConstraints?: boolean;
  /** Pre-fetched minimum `lf / (cva + lf + partyAmm)` portion (decimal fraction). */
  minAcceptablePortionLf?: string;
  /** Pre-fetched minimum locked-margin sum (decimal string). */
  minAcceptableQuoteValue?: string;
  /** Pre-fetched maximum notional position value; `0` ⇒ unpublished. */
  maxNotionalValue?: number;
  /** Pre-fetched minimum notional position value (decimal string). */
  minNotionalValue?: string;
  /** Pre-fetched maximum order quantity (decimal string); `"0"` ⇒ unpublished. */
  maxQuantity?: string;
  /** Pre-fetched minimum tradable increment / lot size (decimal string). */
  lotSize?: string;
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
  const { minAcceptablePortionLf, minAcceptableQuoteValue, maxNotionalValue } = parameters;
  const { minNotionalValue, maxQuantity, lotSize } = parameters;
  const needCaps = parameters.includeSolverFeeCaps === true;
  const capsPrefilled = minOpenSolverFeeCap !== undefined && minCloseSolverFeeCap !== undefined;
  const needFees = parameters.includeHedgerFees === true;
  const feesPrefilled = hedgerFeeOpen !== undefined && hedgerFeeClose !== undefined;
  const needConstraints = parameters.includeQuoteConstraints === true;
  const constraintsPrefilled =
    minAcceptablePortionLf !== undefined &&
    minAcceptableQuoteValue !== undefined &&
    maxNotionalValue !== undefined &&
    minNotionalValue !== undefined &&
    maxQuantity !== undefined &&
    lotSize !== undefined;

  if (
    marketName !== undefined &&
    pricePrecision !== undefined &&
    quantityPrecision !== undefined &&
    (!needCaps || capsPrefilled) &&
    (!needFees || feesPrefilled) &&
    (!needConstraints || constraintsPrefilled)
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
      ...(needConstraints
        ? { minAcceptablePortionLf, minAcceptableQuoteValue, maxNotionalValue, minNotionalValue, maxQuantity, lotSize }
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
    ...(needConstraints
      ? {
          minAcceptablePortionLf: minAcceptablePortionLf ?? match.minAcceptablePortionLf,
          minAcceptableQuoteValue: minAcceptableQuoteValue ?? match.minAcceptableQuoteValue,
          maxNotionalValue: maxNotionalValue ?? match.maxNotionalValue,
          minNotionalValue: minNotionalValue ?? match.minNotionalValue,
          maxQuantity: maxQuantity ?? match.maxQuantity,
          lotSize: lotSize ?? match.lotSize,
        }
      : {}),
  };
}
