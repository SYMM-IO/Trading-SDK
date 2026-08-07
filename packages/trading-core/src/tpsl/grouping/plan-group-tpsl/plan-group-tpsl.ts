import { toDecimal } from "@symmio/utils/decimal";
import { formatUnits } from "viem";
import type { SetTpSlSide } from "../../set-quote-tpsl/set-quote-tpsl";
import type { TpSlConfig, TpSlValidation } from "../../types";
import { validateTpSl } from "../../validate-tpsl";
import { resolveChildSide, type ResolvedChildSide } from "../resolve-child-side";
import type { GroupTpSlAction, GroupTpSlChild, GroupTpSlDesiredMap, PlanGroupTpSlResult } from "../types";

/** Decimal places of an 18-decimal-wei fixed-point value. */
const WEI_DECIMALS = 18;

/** Parameters for {@link planGroupTpSl}. */
export interface PlanGroupTpSlParameters {
  /** The grouped position's children with their confirmed snapshots. */
  children: readonly GroupTpSlChild[];
  /** Desired state per child key. A child with no entry is skipped as `"nothing-to-do"`. */
  desired: GroupTpSlDesiredMap;
  /**
   * Market price precision. Trigger prices are rounded to it **before** diffing,
   * so `"100"` and `"100.0000"` compare as unchanged.
   */
  pricePrecision: number;
  /**
   * Reference price every child validates against (decimal string). Pass the
   * live **mark** price — a grouped position is validated against what the
   * trader is looking at, not against each child's own open price. Omit
   * (together with `config`) to skip validation entirely.
   */
  referencePrice?: string;
  /** Live handler `/configs/` rules. Required for validation to run. */
  config?: TpSlConfig;
  /** Restrict planning to these child keys — the retry-failed-only path. Others are omitted. */
  only?: readonly string[];
}

/**
 * Diff a desired grouped TP/SL state against what the handler already holds and
 * decide, per child, whether to `set`, `delete`, or `skip`.
 *
 * The handler has **no bulk endpoint** — one signed request per quote — so the
 * planner's job is to make that fan-out as small as honestly possible:
 *
 * - a side whose rounded trigger price **and** price type already match the
 *   confirmed snapshot is dropped from the leg, so `setQuoteTpSl` receives only
 *   the sides that actually changed; when both sides drop, the child is skipped
 *   as `"unchanged"`;
 * - a side cleared to `""` while the handler holds a live order becomes a
 *   `delete`; cleared with nothing live, it is dropped;
 * - unanchored / zero-open-size children are skipped with a typed reason rather
 *   than throwing;
 * - when `referencePrice` and `config` are supplied, each child runs
 *   `validateTpSl` against its **resulting** pair (so the TP↔SL spread rule sees
 *   an untouched side too) with `isOpenPosition: true`; a failure becomes
 *   `"invalid"` carrying the `TpSlValidation` for inline errors.
 *
 * A child can yield two actions (cancel one side, write the other), so
 * `actions` is not one entry per child. Pure and deterministic.
 *
 * @param parameters - Children, desired state, precision, optional validation inputs.
 * @returns Per-child actions plus the pre-split `sets` / `deletes` / `skips` lists.
 *
 * @example
 * ```ts
 * const plan = planGroupTpSl({
 *   children,
 *   desired: Object.fromEntries(children.map((child) => [child.key, { tp: { triggerPrice: "150" } }])),
 *   pricePrecision: 4,
 *   referencePrice: markPrice,
 *   config: tpslConfig,
 * });
 * if (plan.hasInvalid) return;
 * for (const set of plan.sets) await setQuoteTpSl(config, { ...set, subAccount, pricePrecision: 4 });
 * ```
 */
export function planGroupTpSl(parameters: PlanGroupTpSlParameters): PlanGroupTpSlResult {
  const { children, desired, pricePrecision, referencePrice, config, only } = parameters;
  const allowed = only === undefined ? undefined : new Set(only);
  const actions: GroupTpSlAction[] = [];

  for (const child of children) {
    if (allowed !== undefined && !allowed.has(child.key)) continue;

    const entry = desired[child.key];
    if (!entry || (entry.tp === undefined && entry.sl === undefined)) {
      actions.push({ action: "skip", key: child.key, reason: "nothing-to-do" });
      continue;
    }

    if (child.quoteId === undefined || child.virtualAccount === undefined) {
      actions.push({ action: "skip", key: child.key, reason: "not-anchored" });
      continue;
    }

    if (child.openQuantity <= 0n) {
      actions.push({ action: "skip", key: child.key, reason: "no-open-quantity" });
      continue;
    }

    const tp = resolveChildSide(child, "tp", desired);
    const sl = resolveChildSide(child, "sl", desired);

    const tpDecision = decideSide(tp, pricePrecision);
    const slDecision = decideSide(sl, pricePrecision);

    // Unparseable prices are caught by the decision step, so validation below
    // only ever sees numbers.
    if (tpDecision.kind === "unparseable" || slDecision.kind === "unparseable") {
      actions.push({
        action: "skip",
        key: child.key,
        reason: "invalid",
        validation: {
          ok: false,
          tpError: tpDecision.kind === "unparseable" ? "Enter a valid price" : undefined,
          slError: slDecision.kind === "unparseable" ? "Enter a valid price" : undefined,
        },
      });
      continue;
    }

    const validation = validateResultingPair(child, tp, sl, pricePrecision, referencePrice, config);
    if (validation && !validation.ok) {
      actions.push({ action: "skip", key: child.key, reason: "invalid", validation });
      continue;
    }

    if (tpDecision.kind === "delete") {
      actions.push({
        action: "delete",
        key: child.key,
        quoteId: child.quoteId,
        virtualAccount: child.virtualAccount,
        cohQuoteId: tpDecision.cohQuoteId,
        conditionalOrderType: "take_profit",
      });
    }
    if (slDecision.kind === "delete") {
      actions.push({
        action: "delete",
        key: child.key,
        quoteId: child.quoteId,
        virtualAccount: child.virtualAccount,
        cohQuoteId: slDecision.cohQuoteId,
        conditionalOrderType: "stop_loss",
      });
    }

    if (tpDecision.kind === "set" || slDecision.kind === "set") {
      actions.push({
        action: "set",
        key: child.key,
        quoteId: child.quoteId,
        virtualAccount: child.virtualAccount,
        symbolId: child.symbolId,
        positionType: child.positionType,
        quantity: formatUnits(child.openQuantity, WEI_DECIMALS),
        tp: tpDecision.kind === "set" ? tpDecision.side : undefined,
        sl: slDecision.kind === "set" ? slDecision.side : undefined,
      });
      continue;
    }

    if (tpDecision.kind === "none" && slDecision.kind === "none") {
      actions.push({ action: "skip", key: child.key, reason: "unchanged" });
    }
  }

  const sets = actions.filter((action) => action.action === "set");
  const deletes = actions.filter((action) => action.action === "delete");
  const skips = actions.filter((action) => action.action === "skip");

  return {
    actions,
    sets,
    deletes,
    skips,
    hasInvalid: skips.some((skip) => skip.reason === "invalid"),
    isNoop: sets.length === 0 && deletes.length === 0,
  };
}

/** What the planner decided for a single side of a single child. */
type SideDecision =
  | { kind: "none" }
  | { kind: "set"; side: SetTpSlSide }
  | { kind: "delete"; cohQuoteId: string }
  | { kind: "unparseable" };

/**
 * Diff one resolved side. Rounding both the wanted and the confirmed price to
 * `pricePrecision` before comparing is what makes `"100"` and `"100.0000"`
 * equal — the handler stores whatever it rounded to, so a raw string compare
 * would resubmit unchanged orders forever.
 */
function decideSide(resolved: ResolvedChildSide, pricePrecision: number): SideDecision {
  const wanted = round(resolved.triggerPrice, pricePrecision);
  if (wanted === undefined) return { kind: "unparseable" };
  const current = round(resolved.confirmedPrice, pricePrecision) ?? "";

  if (!wanted) {
    if (current && resolved.cohQuoteId) return { kind: "delete", cohQuoteId: resolved.cohQuoteId };
    return { kind: "none" };
  }

  if (wanted === current && resolved.priceType === resolved.confirmedPriceType) return { kind: "none" };

  return { kind: "set", side: { triggerPrice: wanted, priceType: resolved.priceType } };
}

/**
 * Validate the pair the child would **end up with**, not just the edited side —
 * otherwise raising a take-profit could silently violate the TP↔SL spread rule
 * against an untouched stop-loss.
 */
function validateResultingPair(
  child: GroupTpSlChild,
  tp: ResolvedChildSide,
  sl: ResolvedChildSide,
  pricePrecision: number,
  referencePrice?: string,
  config?: TpSlConfig,
): TpSlValidation | undefined {
  if (referencePrice === undefined || config === undefined) return undefined;
  return validateTpSl({
    takeProfitPrice: tp.triggerPrice || undefined,
    stopLossPrice: sl.triggerPrice || undefined,
    openPrice: referencePrice,
    positionType: child.positionType,
    pricePrecision,
    config,
    isOpenPosition: true,
  });
}

/**
 * Round a decimal price string to `pricePrecision`. Empty input stays empty;
 * a string that is not a number at all returns `undefined` so the caller can
 * report it as invalid instead of silently reading it as "clear this side".
 */
function round(price: string, pricePrecision: number): string | undefined {
  if (!price) return "";
  try {
    const decimal = toDecimal(price);
    if (!decimal.isFinite()) return undefined;
    return decimal.toFixed(pricePrecision);
  } catch {
    return undefined;
  }
}
