"use client";

import { WEI_DECIMALS } from "@/lib/format";
import type { GroupTpSlChild, GroupTpSlDesiredMap, GroupTpSlSideKey } from "@symmio/trading-core";
import { PositionType } from "@symmio/trading-core";
import { Input } from "@symmio/ui/components/input";
import { cn } from "@symmio/ui/lib/utils";
import { formatTokenAmount } from "@symmio/utils";
import { toDecimal } from "@symmio/utils/decimal";
import { GroupTpSlCoverageBar } from "./group-tpsl-coverage-bar";

/** One end of the rail. */
interface Rung {
  side: GroupTpSlSideKey;
  /** Staged-or-confirmed trigger price (decimal string). Empty when there is no exit. */
  triggerPrice: string;
  /** Signed distance from the reference price, in percent. `undefined` without both prices. */
  distancePercent?: number;
  /** Estimated PnL at this trigger across the whole group, wei (signed). */
  pnl?: bigint;
  /** Notional-weighted share of the position this side protects, 0–100. */
  coverage: number;
  /** Legs protected / legs total. */
  count: number;
  total: number;
  /** `true` while any leg's side is mid-flight. */
  isPending: boolean;
  /** Inline validation message, when the staged value is rejected. */
  error?: string;
}

interface Props {
  legs: readonly GroupTpSlChild[];
  overrides: GroupTpSlDesiredMap;
  /** Live mark price (decimal string). Empty until the first tick. */
  referencePrice: string;
  /** Group direction — decides which end of the rail each side sits on. */
  positionType?: PositionType;
  takeProfit: Rung;
  stopLoss: Rung;
  onChange: (side: GroupTpSlSideKey, triggerPrice: string) => void;
  onClear: (side: GroupTpSlSideKey) => void;
  disabled?: boolean;
}

export type { Rung as GroupTpSlRung };

/**
 * The exit rail: one vertical price axis with the live mark price pinned at its
 * centre, the take profit on the profitable side and the stop loss on the
 * losing side.
 *
 * A merged position's exits are two ends of one range around the current price,
 * and the number a trader reasons in is *distance from here* — not an absolute
 * figure typed into a form field. So price, distance, resulting PnL and how much
 * of the position each end actually protects all sit on one row, and the two
 * rows sit either side of the mark.
 *
 * The rail is **ordinal, not metric**: a 0.5% stop and a 300% take profit cannot
 * share a linear axis without one of them becoming invisible, so position on the
 * rail encodes direction exactly and magnitude lives in the number. Rungs swap
 * ends for a short, because which way profit lies is itself information.
 */
export function GroupTpSlRail({
  legs,
  overrides,
  referencePrice,
  positionType,
  takeProfit,
  stopLoss,
  onChange,
  onClear,
  disabled = false,
}: Props) {
  const isShort = positionType === PositionType.SHORT;
  /** Profit is up for a long, down for a short. */
  const upper = isShort ? stopLoss : takeProfit;
  const lower = isShort ? takeProfit : stopLoss;

  return (
    <div className="flex flex-col">
      <Rail rung={upper} legs={legs} overrides={overrides} onChange={onChange} onClear={onClear} disabled={disabled} />

      <div className="flex items-center gap-3 py-2.5">
        <span className="via-border to-border h-px flex-1 bg-gradient-to-r from-transparent" aria-hidden />
        <span className="text-muted-foreground flex items-baseline gap-2 font-mono text-xs">
          <span className="text-[0.6rem] tracking-[0.18em] uppercase">mark</span>
          <span className="text-foreground tabular-nums">{referencePrice || "—"}</span>
        </span>
        <span className="via-border to-border h-px flex-1 bg-gradient-to-l from-transparent" aria-hidden />
      </div>

      <Rail rung={lower} legs={legs} overrides={overrides} onChange={onChange} onClear={onClear} disabled={disabled} />
    </div>
  );
}

/**
 * Per-side copy and the glyph that names the side.
 *
 * Identity lives on the leading icon and the coverage bar below — never on the
 * field itself, which wears the same chrome as every other input in the app.
 * The glyphs' arrows read as *outcome*, not as price direction: taking profit
 * is the up case and stopping out the down case for a short as much as a long.
 */
const COPY = {
  tp: {
    label: "take profit",
    empty: "No take profit",
    aria: "Take profit price for the whole position",
    tone: "text-positive",
  },
  sl: {
    label: "stop loss",
    empty: "No stop loss",
    aria: "Stop loss price for the whole position",
    tone: "text-info",
  },
} as const;

/**
 * The field box, mirroring `@symmio/ui`'s `Input` through `focus-within` — the
 * real input inside is stripped bare so the box can hold the readout and the
 * clear button too. Hover follows `SelectTrigger`, the design system's one
 * field-shaped control that defines one.
 */
const FIELD = "border-border bg-input/40 hover:bg-input/60";
const FIELD_FOCUS = "focus-within:border-ring focus-within:bg-input/60 focus-within:ring-ring/30 focus-within:ring-3";

/**
 * The rejected-price box — the primitive's own `aria-invalid` treatment, so a
 * bad exit price looks like a bad value anywhere else in the app. Swapped in
 * rather than layered on: an exclusive branch is the only way to guarantee no
 * resting class survives inside an errored field.
 */
const FIELD_INVALID =
  "border-destructive bg-destructive/5 ring-destructive/25 ring-3 dark:bg-destructive/10 dark:ring-destructive/35 focus-within:border-destructive focus-within:ring-destructive/25";

/** One rung: label, price input, distance, PnL, coverage. */
function Rail({
  rung,
  legs,
  overrides,
  onChange,
  onClear,
  disabled,
}: {
  rung: Rung;
  legs: readonly GroupTpSlChild[];
  overrides: GroupTpSlDesiredMap;
  onChange: (side: GroupTpSlSideKey, triggerPrice: string) => void;
  onClear: (side: GroupTpSlSideKey) => void;
  disabled: boolean;
}) {
  const copy = COPY[rung.side];
  const set = rung.triggerPrice.length > 0;
  const invalid = Boolean(rung.error);
  const errorId = `group-tpsl-${rung.side}-error`;
  /**
   * The leg count only earns its place when coverage is uneven — `3/3` says
   * nothing the bar and the percentage below it do not already say.
   */
  const partial = rung.count > 0 && rung.count < rung.total;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-[0.6rem] tracking-[0.18em] uppercase">{copy.label}</span>
        {partial ? (
          <span className="text-muted-foreground/80 font-mono text-[0.65rem] tabular-nums">
            {rung.count} of {rung.total} legs
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-md border transition-[color,box-shadow,background-color,border-color]",
          invalid ? FIELD_INVALID : cn(FIELD, FIELD_FOCUS),
        )}
      >
        <span className={cn("flex shrink-0 items-center pl-3", copy.tone)} aria-hidden>
          {rung.side === "tp" ? <TakeProfitGlyph /> : <StopLossGlyph />}
        </span>
        <Input
          value={rung.triggerPrice}
          onChange={(event) => onChange(rung.side, event.target.value)}
          placeholder={copy.empty}
          inputMode="decimal"
          disabled={disabled}
          aria-label={copy.aria}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          data-testid={`group-tpsl-${rung.side}-input`}
          className={cn(
            "h-auto flex-1 border-0 bg-transparent px-2.5 py-2.5 font-mono text-xl tabular-nums shadow-none",
            "focus-visible:bg-transparent focus-visible:ring-0",
            /** The box owns both the focus and the invalid treatment; stop the primitive drawing a second one inside it. */
            "aria-invalid:border-transparent aria-invalid:bg-transparent aria-invalid:ring-0 aria-invalid:ring-transparent dark:aria-invalid:bg-transparent dark:aria-invalid:ring-transparent",
            set ? "text-foreground" : "text-muted-foreground",
          )}
        />
        <span className="grid shrink-0 grid-cols-[auto_auto] items-baseline gap-x-2 gap-y-0.5 py-2 pr-3 text-right">
          <span className="text-muted-foreground/60 text-[0.55rem] tracking-[0.1em] uppercase">from mark</span>
          {/** Achromatic on purpose: the sign already says which way, and a red −85% on a valid stop is the exact thing being fixed. */}
          <span
            className={cn(
              "font-mono text-[0.7rem] tabular-nums",
              rung.distancePercent === undefined ? "text-muted-foreground/60" : "text-foreground",
            )}
          >
            {formatSignedPercent(rung.distancePercent)}
          </span>
          <span className="text-muted-foreground/60 text-[0.55rem] tracking-[0.1em] uppercase">if hit</span>
          <span className="text-muted-foreground font-mono text-[0.7rem] tabular-nums">
            {formatSignedUsd(rung.pnl)}
          </span>
        </span>
        {set ? (
          <button
            type="button"
            onClick={() => onClear(rung.side)}
            disabled={disabled}
            aria-label={`Remove the ${copy.label}`}
            title={`Remove the ${copy.label}`}
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring border-border/60 flex w-9 items-center justify-center border-l transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <CloseGlyph />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5">
        <GroupTpSlCoverageBar legs={legs} side={rung.side} overrides={overrides} compact />
        <span
          className={cn(
            "w-24 shrink-0 text-right font-mono text-[0.65rem] tabular-nums",
            rung.coverage > 0 ? "text-muted-foreground" : "text-muted-foreground/50",
          )}
        >
          {rung.isPending ? "confirming…" : `${Math.round(rung.coverage)}% of size`}
        </span>
      </div>

      {rung.error ? (
        <p id={errorId} role="alert" className="text-destructive flex items-center gap-1.5 text-[0.7rem]">
          <AlertGlyph />
          {rung.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Signed percent distance, e.g. `+18.40%`. Em dash when not computable, and
 * capped past 999% so a fat-fingered price cannot stretch the row.
 */
function formatSignedPercent(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "−";
  const magnitude = Math.abs(value);
  if (magnitude > 999) return `${sign}999%+`;
  return `${sign}${magnitude.toFixed(2)}%`;
}

/**
 * Signed USD figure from an 18-decimal wei bigint, e.g. `+$4.21`. Falls back to
 * finer precision when cents would round a real amount away to `$0` — a lowcap
 * position's whole return can live below a cent.
 */
function formatSignedUsd(value?: bigint): string {
  if (value === undefined) return "—";
  if (value === 0n) return "$0";
  const sign = value >= 0n ? "+" : "−";
  const magnitude = value < 0n ? -value : value;
  const cents = formatTokenAmount(magnitude, WEI_DECIMALS, { maxFractionDigits: 2 });
  const shown = Number(cents) === 0 ? formatTokenAmount(magnitude, WEI_DECIMALS, { maxFractionDigits: 6 }) : cents;
  return `${sign}$${shown}`;
}

/**
 * Signed distance of `price` from `reference`, in percent. Returns `undefined`
 * when either side is missing or unparseable, so a half-typed price shows `—`
 * rather than a wrong number.
 */
export function distancePercentOf(price: string, reference: string): number | undefined {
  if (!price || !reference) return undefined;
  try {
    const target = toDecimal(price);
    const base = toDecimal(reference);
    if (!target.isFinite() || !base.isFinite() || base.isZero()) return undefined;
    return target.minus(base).div(base).times(100).toNumber();
  } catch {
    return undefined;
  }
}

/**
 * Take profit — price action running up into the level that closes the trade in
 * profit. The rule bar is the level; the arrow is what the position does to reach it.
 */
function TakeProfitGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden
    >
      <path d="M3.25 3.25h17.5" />
      <path d="M2.75 19.5 7.5 14.5 11 18 17.25 10" />
      <path d="M12.9 11.6 17.25 10l-.5 4.6" />
    </svg>
  );
}

/** Stop loss — the mirror: price running down into the level that closes the trade out. */
function StopLossGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden
    >
      <path d="M2.75 4.5 7.5 9.5 11 6l6.25 8" />
      <path d="M12.9 12.4 17.25 14l-.5-4.6" />
      <path d="M3.25 20.75h17.5" />
    </svg>
  );
}

/** Marks a rejected price. The one thing in the rail that only ever means "invalid". */
function AlertGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="size-3.5 shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" strokeLinecap="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}
