import { formatPrice } from "@/lib/format";

export interface PositionPriceRailProps {
  /** Price the position opened at. */
  entry: number;
  /** Live mark. `undefined` while the feed has not ticked. */
  mark?: number;
  /** Protocol liquidation price. `undefined` when the SDK cannot compute one. */
  liquidation?: number;
  isLong: boolean;
  /** Market price precision, so the labels round the way the market quotes. */
  precision?: number;
}

/**
 * Where the market is, between where this position opened and where it dies.
 *
 * A liquidation price rendered as a bare number is a fact a trader still has to
 * do arithmetic on: `$0.7569` says nothing about whether that is a bad tick away
 * or a bad month away. The distance is the thing worth knowing, so it is drawn
 * rather than left to be computed.
 *
 * ## The scale
 *
 * Entry sits at the centre and liquidation at the losing end, which fixes the
 * unit: half the track is exactly the move that wipes the position out. The mark
 * is then plotted in that unit — a third of the way toward the edge means a
 * third of the buffer is gone — and the profit half is the same distance mirrored,
 * so the two sides are comparable. Direction is normalised, so a short reads
 * left-to-right like a long: the losing end is always the left.
 *
 * A mark beyond either end is pinned to it rather than rescaling the track,
 * because a position 3× past its entry should not shrink its own liquidation
 * distance to a sliver — and past the left end the position is being liquidated,
 * which the colour already says louder than a coordinate could.
 */
export function PositionPriceRail({ entry, mark, liquidation, isLong, precision }: PositionPriceRailProps) {
  const span = liquidation !== undefined && liquidation > 0 ? Math.abs(entry - liquidation) : undefined;

  /* Signed in the position's favour: positive is profit for both sides. */
  const move = mark === undefined ? undefined : isLong ? mark - entry : entry - mark;
  const ratio = move === undefined || span === undefined || span === 0 ? undefined : move / span;

  const position = ratio === undefined ? undefined : clamp((ratio + 1) / 2, 0, 1) * 100;
  const inProfit = (move ?? 0) >= 0;
  const tone = inProfit ? "var(--long-500)" : "var(--short-500)";

  return (
    <div className="flex flex-col gap-1.5">
      {/* No liquidation price means no scale — the track has no unit to plot the
          mark in, and drawing an empty one implies a reading that is not there.
          The labels below still carry every figure, so only the bar goes. */}
      {span === undefined ? null : (
        <div className="relative h-[18px]">
          {/* The track. The losing end carries a red wash so the direction of
            danger is legible before any label is read. */}
          <span className="absolute top-[7px] right-0 left-0 h-1 overflow-hidden rounded-full bg-bg-0">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[22%]"
              style={{ background: "linear-gradient(90deg, var(--short-500), transparent)", opacity: 0.5 }}
            />
            {position !== undefined ? (
              <span
                aria-hidden
                className="absolute inset-y-0"
                style={{
                  /* Drawn from the centre out to the mark, so the bar's length is
                   the move itself rather than an absolute price. */
                  left: `${Math.min(50, position)}%`,
                  width: `${Math.abs(position - 50)}%`,
                  background: tone,
                  transition: "left var(--dur-base) var(--ease-out), width var(--dur-base) var(--ease-out)",
                }}
              />
            ) : null}
          </span>

          {/* Entry: a hairline at dead centre, not a dot — it is the origin the
            rest of the rail is measured from, not another reading on it. */}
          <span aria-hidden className="absolute top-[3px] left-1/2 h-3 w-px -translate-x-1/2 rounded-full bg-fg-2" />

          {position !== undefined ? (
            <span
              aria-hidden
              className="absolute top-[4px] size-2.5 -translate-x-1/2 rounded-full border-2 border-bg-1"
              style={{
                left: `${position}%`,
                background: tone,
                transition: "left var(--dur-base) var(--ease-out)",
              }}
            />
          ) : null}
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3 text-2xs">
        <span className="flex items-baseline gap-1 text-fg-3">
          Liq.
          <span className={span === undefined ? "tnum font-semibold text-fg-3" : "tnum font-semibold text-short"}>
            {span === undefined ? "none at this size" : formatPrice(liquidation ?? 0, precision)}
          </span>
        </span>

        <span className="flex items-baseline gap-1 text-fg-3">
          Entry
          <span className="tnum font-semibold text-fg-1">{formatPrice(entry, precision)}</span>
        </span>

        <span className="flex items-baseline gap-1 text-fg-3">
          Mark
          <span className="tnum font-semibold" style={{ color: mark === undefined ? "var(--fg-3)" : tone }}>
            {mark === undefined ? "—" : formatPrice(mark, precision)}
          </span>
        </span>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
