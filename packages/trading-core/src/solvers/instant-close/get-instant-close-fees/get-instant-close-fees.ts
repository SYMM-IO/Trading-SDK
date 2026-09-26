import { toDecimal } from "@symmio/utils/decimal";
import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import type { FeeForUser } from "../../../symmio-contracts/symmio/actions/get-fee-for-user";
import type { EnigmaSolverInfo } from "../../get-solver-info";
import { computePlatformFeeLegs } from "../../instant-open/shared/trade-math";
import { resolveFeeRates, resolveMarket, resolveMarkPrice, resolveSolverInfo } from "../../shared/resolvers";
import { calculateSolverCloseFee, getSolverCloseFeeRate } from "../../shared/solver-close-fee";

/**
 * Market identification for {@link getInstantCloseFees} — the id plus optional
 * pre-fetched metadata; every pre-filled field skips part of the market fetch.
 */
export interface InstantCloseFeesMarketData {
  /** Market / symbol id. */
  id: number;
  /** Pre-fetched market name. */
  name?: string;
  /** Pre-fetched price precision (decimals). */
  pricePrecision?: number;
  /** Pre-fetched quantity precision (decimals). */
  quantityPrecision?: number;
  /** Pre-fetched solver open-fee rate — only consulted for the resolver short-circuit. */
  hedgerFeeOpen?: string;
  /** Pre-fetched solver standard (floor) close-fee rate (decimal fraction string). */
  hedgerFeeClose?: string;
  /** Pre-fetched early (peak) close-fee rate (decimal fraction string). */
  hedgerFeeCloseEarlyRate?: string;
  /** Pre-fetched early-window length in seconds. */
  hedgerFeeCloseEarlyThreshold?: number;
  /** Pre-fetched standard-rate threshold in seconds. */
  hedgerFeeCloseStandardThreshold?: number;
}

/**
 * Parameters for {@link getInstantCloseFees}.
 */
export type GetInstantCloseFeesParameters = Compute<
  ReadSolverParameter & {
    /** PartyA the platform close-fee rate is read for (`getFeeForUser`). */
    subAccountAddress: Address;
    /** Market identification + optional pre-fetched metadata. */
    market: InstantCloseFeesMarketData;
    /** Leveraged base-asset quantity being closed (decimal string). */
    quantity: string;
    /**
     * When the position opened, in unix seconds — the holding time the solver
     * close-fee schedule is priced at is `now − openedAt`. When omitted on a
     * lowcap solver the schedule is priced at holding time `0` (the early-rate
     * worst case) — the conservative default for an unknown age.
     */
    openedAt?: bigint | number;
    /**
     * Override for "now" in unix seconds. Defaults to the current clock at
     * call time; pass a fixed value for deterministic previews and tests.
     */
    now?: number;
    /** Pre-fetched mark price as decimal string. When omitted, fetched via the price service. */
    markPrice?: string;
    /** Pre-fetched on-chain fee rates (matches `getFeeForUser` return). When omitted, fetched. */
    feeRates?: FeeForUser;
    /**
     * Pre-fetched solver static fees (matches `getSolverInfo` return) —
     * **lowcap/Enigma only**; ignored on any other solver kind. When omitted on
     * a lowcap solver, fetched via `getSolverInfo` (fail-soft: an unreachable
     * `/info` prices the static close leg at `"0"`).
     */
    solverInfo?: EnigmaSolverInfo;
  }
>;

/**
 * Fee legs every solver kind charges **at close**.
 */
export interface BaseInstantCloseFees {
  /**
   * Platform close fee: `getFeeForUser.closeFee × notional / 1e18` (decimal
   * string). Charged on-chain from the allocated balance after PnL settlement.
   */
  platformCloseFee: string;
  /** Close notional the rates were applied to: `quantity × markPrice` (decimal string). */
  notional: string;
  /** Sum of every close leg this kind charges (decimal string). */
  totalFee: string;
}

/**
 * Fee breakdown for a **lowcap (Enigma)** instant close. Extends the platform
 * leg with the solver legs charged at close execution.
 */
export interface EnigmaInstantCloseFees extends BaseInstantCloseFees {
  /** Discriminant: these fees were priced for an Enigma (lowcap) solver. */
  kind: "enigma";
  /**
   * Solver close fee at the priced holding time (decimal string) — the
   * schedule decays from the early (peak) rate to the standard rate as the
   * position ages. Capped on-chain by the `closeRateCap` the open signed.
   */
  closeSolverFee: string;
  /** The close-fee rate the leg was priced at (decimal fraction string) — for rate displays. */
  closeSolverFeeRate: string;
  /** Holding time the schedule was evaluated at, in seconds. */
  holdingSeconds: number;
  /**
   * Static solver close fee — a flat USD amount from the solver's `/info`
   * config, independent of the notional (decimal string). `"0"` when the
   * solver publishes none.
   */
  staticSolverFeeClose: string;
}

/**
 * Fee breakdown for a **majors (Rasa)** instant close — the platform close leg
 * only.
 */
export interface RasaInstantCloseFees extends BaseInstantCloseFees {
  /** Discriminant: these fees were priced for a Rasa (majors) solver. */
  kind: "rasa";
}

/**
 * Return type of {@link getInstantCloseFees}. Narrow on `kind` to reach the
 * lowcap-only legs.
 */
export type GetInstantCloseFeesReturnType = EnigmaInstantCloseFees | RasaInstantCloseFees;

/**
 * Preview every fee closing a position pays **right now** — priced from the
 * current mark price and the position's real holding time, without signing or
 * submitting anything. The open flow deliberately does not preview these legs
 * (`getInstantOpenFees` is open-side only): at open the close notional and the
 * holding-time rate are unknown, so the honest number only exists here.
 *
 * - **Both kinds**: `platformCloseFee` (on-chain `getFeeForUser.closeFee` ×
 *   close notional) — the contract charges it from the allocated balance after
 *   PnL settlement.
 * - **Lowcap (Enigma) only**: `closeSolverFee` — the close-fee schedule
 *   (early → standard decay) evaluated at `now − openedAt` seconds, capped
 *   on-chain by the `closeRateCap` the open signed — plus the flat
 *   `staticSolverFeeClose` from the solver's `/info` config.
 *
 * The holding time is stamped at call time: `now` defaults to the current
 * clock; pass it explicitly for deterministic previews. An omitted `openedAt`
 * prices the worst case (holding time `0`, the peak rate).
 *
 * @throws {SymmError} `INVALID_TRADE_PARAMETERS` when `quantity` is not a
 *   positive number or the mark price resolves to zero/NaN;
 *   `RESOLVE_MARKET_NOT_FOUND` / `RESOLVE_MARK_PRICE_NOT_FOUND` for
 *   unresolvable inputs.
 *
 * @example
 * ```ts
 * const fees = await getInstantCloseFees(config, {
 *   subAccountAddress,
 *   market: { id: 1 },
 *   quantity: "2.5",
 *   openedAt: position.createTimestamp,
 * });
 * if (fees.kind === "enigma") console.log(fees.closeSolverFee, fees.holdingSeconds);
 * console.log(fees.totalFee);
 * ```
 */
export async function getInstantCloseFees(
  config: Config,
  parameters: GetInstantCloseFeesParameters,
): Promise<GetInstantCloseFeesReturnType> {
  // `Number` first: the decimal wrapper throws on a malformed string, and this
  // guard must reject with a typed SDK error instead.
  const quantityNumber = Number(parameters.quantity);
  if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
    throw new SymmError(
      "validation",
      "INVALID_TRADE_PARAMETERS",
      "getInstantCloseFees: quantity must be a positive decimal string.",
    );
  }
  const quantityDec = toDecimal(parameters.quantity);

  /** The solver close-fee schedule and the static leg exist only on lowcap (Enigma) solvers. */
  const isLowcap = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId }).id === "enigma";

  const market = await resolveMarket(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    marketId: parameters.market.id,
    marketName: parameters.market.name,
    pricePrecision: parameters.market.pricePrecision,
    quantityPrecision: parameters.market.quantityPrecision,
    hedgerFeeOpen: parameters.market.hedgerFeeOpen,
    hedgerFeeClose: parameters.market.hedgerFeeClose,
    hedgerFeeCloseEarlyRate: parameters.market.hedgerFeeCloseEarlyRate,
    hedgerFeeCloseEarlyThreshold: parameters.market.hedgerFeeCloseEarlyThreshold,
    hedgerFeeCloseStandardThreshold: parameters.market.hedgerFeeCloseStandardThreshold,
    includeHedgerFees: isLowcap,
  });
  const [markPrice, feeRates, staticFees] = await Promise.all([
    resolveMarkPrice(config, {
      chainId: parameters.chainId,
      solverId: parameters.solverId,
      marketName: market.name,
      markPrice: parameters.markPrice,
    }),
    resolveFeeRates(config, {
      chainId: parameters.chainId,
      subAccountAddress: parameters.subAccountAddress,
      marketId: parameters.market.id,
      feeRates: parameters.feeRates,
    }),
    // The static close fee is a lowcap leg — majors previews never fetch it.
    isLowcap
      ? resolveSolverInfo(config, {
          chainId: parameters.chainId,
          solverId: parameters.solverId,
          solverInfo: parameters.solverInfo,
        })
      : Promise.resolve({ staticSolverFeeOpen: "0", staticSolverFeeClose: "0" }),
  ]);

  const markPriceDec = toDecimal(markPrice);
  if (markPriceDec.isNaN() || markPriceDec.lte(0)) {
    throw new SymmError(
      "validation",
      "INVALID_TRADE_PARAMETERS",
      "getInstantCloseFees: the resolved mark price is zero or invalid.",
    );
  }
  const notional = quantityDec.times(markPriceDec).toString();

  const { platformCloseFee } = computePlatformFeeLegs(feeRates, notional, notional);

  if (!isLowcap) {
    return {
      kind: "rasa",
      platformCloseFee,
      notional,
      totalFee: platformCloseFee,
    };
  }

  // Holding time stamped at call time: an omitted `openedAt` prices the peak
  // (holding 0); a future `openedAt` (clock skew) clamps to 0 inside the
  // schedule helper.
  const now = parameters.now ?? Math.floor(Date.now() / 1000);
  const holdingSeconds = parameters.openedAt === undefined ? 0 : now - Number(parameters.openedAt);

  const schedule = {
    hedgerFeeClose: market.hedgerFeeClose ?? "0",
    hedgerFeeCloseEarlyRate: market.hedgerFeeCloseEarlyRate ?? market.hedgerFeeClose ?? "0",
    hedgerFeeCloseEarlyThreshold: market.hedgerFeeCloseEarlyThreshold ?? 0,
    hedgerFeeCloseStandardThreshold: market.hedgerFeeCloseStandardThreshold ?? 0,
  };
  const closeSolverFeeRate = getSolverCloseFeeRate(schedule, holdingSeconds);
  const closeSolverFee = calculateSolverCloseFee(schedule, { notional, holdingSeconds });
  const staticSolverFeeClose = staticFees.staticSolverFeeClose;

  return {
    kind: "enigma",
    platformCloseFee,
    notional,
    closeSolverFee,
    closeSolverFeeRate,
    holdingSeconds: Math.max(0, holdingSeconds),
    staticSolverFeeClose,
    totalFee: toDecimal(platformCloseFee).plus(closeSolverFee).plus(staticSolverFeeClose).toString(),
  };
}
