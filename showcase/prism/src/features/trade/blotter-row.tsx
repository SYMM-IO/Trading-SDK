"use client";

import { Button } from "@/components/button";
import { Pill, SolverPill } from "@/components/pill";
import { StatePill } from "@/components/state-pill";
import { DataRow } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE } from "@/config/deployments";
import { marketKey } from "@/features/markets/types";
import { useMergedMarkets } from "@/features/markets/use-merged-markets";
import {
  formatCountdown,
  formatLeverage,
  formatPercent,
  formatPnl,
  formatPrice,
  formatRelativeTime,
  formatSize,
  formatUsd,
  marketLabel,
} from "@/lib/format";
import { isActivePosition, PositionType } from "@symmio/trading-core";
import { useState, type ReactNode } from "react";
import { formatUnits } from "viem";
import { PositionDetailsModal } from "./position-details-modal";
import { PositionMarginModal } from "./position-margin-modal";
import { PositionTpSlCell } from "./position-tpsl-cell";
import type { PrismQuote } from "./positions-provider";
import {
  AWAITING_CANCEL_REASON,
  CLOSE_BLOCKED_REASON,
  resolvePositionIntent,
  switchReasonHint,
  usePositionActions,
} from "./use-position-actions";
import { useQuoteMetrics } from "./use-quote-metrics";

/**
 * The two tabs hold different objects, so they get different columns.
 *
 * A resting order has no unrealized P&L and no exits — it has a level it is
 * waiting for and an age. The blotter used to run both through one template, so
 * every pending order reported `$0.00` of P&L next to an "Entry" it had never
 * traded at: two columns of noise where two columns of fact belong.
 *
 * A grouped position row shares `POSITION_COLUMNS` with the quote rows it folds,
 * which is what keeps a child's figures under the group's own.
 *
 * ## Why no track is content-sized
 *
 * The header and every row are separate grid containers that happen to carry the
 * same template, so they only line up while the template resolves to the same
 * widths in each of them. That holds for `minmax(px, fr)` — a fixed floor plus a
 * share of the leftover — because the result depends on the row's width and
 * nothing else. It stops holding the moment one track is sized by its content.
 *
 * The action column used to end in `minmax(112px, auto)`, and `auto` measures
 * the cell: a flat row holding one `Close` resolved it to 112px, a grouped row
 * holding `Margin` + `Close all` to 140px. The 28px that went to the buttons
 * came out of the seven flexible tracks in that row alone, so the group row's
 * P&L, exits and state each sat some 16-25px left of the header's and of the
 * flat row's above it — the column edges drifted further apart the further right
 * the eye travelled.
 *
 * So the action track gets a floor wide enough for the widest stack it can hold
 * (`Margin` + `Close rest`, ~150px) and a share like every other column. Nothing
 * in either template is measured from content any more, which is what makes the
 * grid the same grid on every row.
 */
export const POSITION_COLUMNS =
  "minmax(168px,1.6fr) minmax(62px,0.5fr) minmax(104px,1fr) minmax(104px,1fr) minmax(120px,1fr) minmax(112px,0.95fr) minmax(108px,0.9fr) minmax(164px,0.9fr)";

/** The orders tab's widest action is a loading `Force cancel` (~115px). */
export const ORDER_COLUMNS =
  "minmax(168px,1.6fr) minmax(62px,0.5fr) minmax(104px,1fr) minmax(112px,1fr) minmax(104px,0.9fr) minmax(108px,0.9fr) minmax(128px,0.9fr)";

export interface BlotterRowProps {
  row: PrismQuote;
  /** An open position and a resting order are different objects with different columns. */
  variant?: "position" | "order";
  /**
   * `child` renders the row as one quote inside an expanded grouped position:
   * the market, the side and the family stripe move to the group row above, and
   * what is left is the part that differs between siblings.
   */
  depth?: "root" | "child";
}

/**
 * One blotter row. Owns its own PnL read so each market prices independently.
 *
 * The whole row opens the details sheet. The controls inside it stop the click
 * from bubbling — a Close that also opened a sheet behind its own confirmation
 * toast would be the same gesture doing two things.
 */
export function BlotterRow({ row, variant = "position", depth = "root" }: BlotterRowProps) {
  const { byKey } = useMergedMarkets({ scope: "all" });
  const [marginOpen, setMarginOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const market = byKey.get(marketKey(row.family, Number(row.quote.symbolId)));
  const actions = usePositionActions(row, market);
  /* Pinned to the row's own market family. The SDK's `useQuoteUpnlAndPnl`
     resolves its feed from the *connected* chain, which is wrong in a merged
     book: sitting on Base, it priced a lowcap position off Binance's BTC tick. */
  const metrics = useQuoteMetrics(row, market);
  const mark = metrics.mark;

  const isChild = depth === "child";
  const name = market ? marketLabel(market.market.symbol, market.market.name) : `#${row.quote.symbolId}`;
  const isLong = row.quote.positionType === PositionType.LONG;
  /* `UnifiedQuote` amounts are 18-decimal bigints. A `Number()` hop loses
     precision on a large position, so the exact string is what gets parsed. */
  const quantity = formatUnits(row.quote.openQuantity, 18);
  const orderQuantity = formatUnits(row.quote.quantity, 18);
  /* `0n` and `undefined` both mean "no fill yet" — the first is an on-chain row
     partyB has not settled, the second an off-chain one. `??` alone only catches
     the second, which is how an unfilled row reported an entry of `0.00` and
     then valued its whole notional as profit against it. */
  const settledOpen =
    row.quote.openedPrice !== undefined && row.quote.openedPrice !== 0n ? row.quote.openedPrice : undefined;
  const entryPrice = Number(formatUnits(settledOpen ?? row.quote.requestedOpenPrice, 18));

  const isOrder = variant === "order";
  const size = Number(isOrder ? orderQuantity : quantity);
  /* Value the position at the live mark where there is one, and fall back to
     the price it was opened at — a notional that silently reads `—` while the
     feed reconnects is worse than one priced a minute ago. */
  const notional = size * (mark ?? entryPrice);

  return (
    <>
      <DataRow
        columns={isOrder ? ORDER_COLUMNS : POSITION_COLUMNS}
        /* The stripe marks a position in the merged book, and a child is not a
           second position — its provenance is the row it is folded under. */
        accent={isChild ? undefined : FAMILY_PALETTE[row.family].base}
        onClick={() => setDetailsOpen(true)}
        /* Children sit *under* the group, so they read recessed rather than
           tinted — a second colour here would compete with the family stripe. */
        className={isChild ? "group/row bg-bg-0/40" : "group/row"}
      >
        {isChild ? (
          <ChildIdentity row={row} leverage={metrics.leverage} />
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-display text-md font-semibold text-fg-0">{name}</span>
              {/* The affordance for a click target that has no button of its own.
                  Hidden until hover so a still blotter stays a table of figures. */}
              <ChevronIcon />
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <SolverPill family={row.family} className="shrink-0" />
              {metrics.leverage > 0 ? (
                <span className="tnum shrink-0 text-2xs font-semibold text-fg-2">
                  {formatLeverage(metrics.leverage)}
                </span>
              ) : null}
              <span className="truncate text-2xs text-fg-3">{row.account.name}</span>
            </span>
          </div>
        )}

        {/* Every quote in a group trades the same market in the same direction —
            that is what the group is keyed on — so repeating the side on each
            child would be a column of identical chips. */}
        {isChild ? <span aria-hidden /> : <SidePill isLong={isLong} />}

        <div className="flex min-w-0 flex-col gap-0.5">
          <Numeric size="sm">{formatSize(size, market?.market.symbol)}</Numeric>
          <span className="tnum truncate text-2xs text-fg-3">{formatUsd(notional)}</span>
        </div>

        {isOrder ? (
          <>
            <Numeric size="sm">{formatPrice(Number(formatUnits(row.quote.requestedOpenPrice, 18)))}</Numeric>
            <span className="truncate text-sm text-fg-2">
              {formatRelativeTime(Number(row.quote.createTimestamp ?? row.quote.statusModifyTimestamp ?? 0n))}
            </span>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Numeric size="sm">{formatPrice(entryPrice)}</Numeric>
              {/* The group row above already carries the mark, and it is the
                  same tick for every child — one market, one price. */}
              {isChild ? null : (
                <span className="tnum truncate text-2xs text-fg-3">
                  {mark === undefined ? "mark —" : `mark ${formatPrice(mark)}`}
                </span>
              )}
            </div>

            {/* An unpriced row reports nothing rather than `$0.00` — "no tick
                yet" and "flat" are different facts. */}
            <div className="flex flex-col gap-0.5">
              <Numeric size="sm" signed={metrics.upnl}>
                {metrics.upnl === undefined ? "—" : formatPnl(metrics.upnl)}
              </Numeric>
              {metrics.upnlPercent === undefined ? null : (
                <span className="tnum text-2xs text-fg-3">{formatPercent(metrics.upnlPercent)}</span>
              )}
            </div>

            <StopClick className="min-w-0">
              <PositionTpSlCell row={row} market={market} />
            </StopClick>
          </>
        )}

        {/* `items-start` is load-bearing: a grid cell stretches its child, and a
            chip stretched across the column reads as a progress bar rather than a
            state. */}
        <div className="flex min-w-0 flex-col items-start gap-1">
          <StatePill lifecycle={row.quote.lifecycle} status={row.quote.quoteStatus} />
          <span className="truncate text-2xs text-fg-3">
            {formatRelativeTime(Number(row.quote.statusModifyTimestamp ?? row.quote.createTimestamp ?? 0n))}
          </span>
        </div>

        <StopClick className="flex items-center justify-end gap-1.5">
          {/* Topping up an isolated position is a per-VA call, so the control
              lives on the position rather than on the account card — where there
              is no VA to target. A cross-margin position has no VA at all.
              It is not gated on the chain: the modal's own submit renders the
              switch, and hiding the entry point makes a one-click-away action
              look unavailable.

              A child inside a group shares its VA with its siblings, so the
              control belongs to the group row and would move the same money
              twice if it were repeated here. */}
          {row.quote.vaAddress && isActivePosition(row.quote) && !isChild ? (
            <Button
              size="sm"
              variant="ghost"
              title="Add or remove this position's margin"
              onClick={() => setMarginOpen(true)}
            >
              Margin
            </Button>
          ) : null}
          <RowAction row={row} actions={actions} />
        </StopClick>
      </DataRow>

      {row.quote.vaAddress && !isChild ? (
        <PositionMarginModal
          deployment={row.deployment}
          account={row.account}
          virtualAccount={row.quote.vaAddress}
          open={marginOpen}
          onClose={() => setMarginOpen(false)}
        />
      ) : null}

      {/* Mounted only while open: the sheet subscribes to funding, balances and
          a margin-risk fold per row, and a blotter of twenty rows must not pay
          for twenty sheets nobody is reading. */}
      {detailsOpen ? (
        <PositionDetailsModal row={row} market={market} open onClose={() => setDetailsOpen(false)} />
      ) : null}
    </>
  );
}

/**
 * A child's identity inside an expanded group.
 *
 * What distinguishes one leg from its siblings is its quote id and the leverage
 * it was opened at — not the market or the side, which the group is keyed on and
 * the row above already states. Repeating those here would make eight identical
 * cells and bury the one field that differs.
 */
function ChildIdentity({ row, leverage }: { row: PrismQuote; leverage: number }) {
  const quoteId = row.quote.quoteId;
  const isAnchored = quoteId !== undefined && quoteId > 0n;

  return (
    <span className="flex min-w-0 items-center gap-2 pl-1">
      <ChildRail />
      <span className="flex min-w-0 items-center gap-1.5">
        {isAnchored ? (
          <span className="tnum truncate text-sm text-fg-1">{`#${quoteId}`}</span>
        ) : (
          <Pill className="shrink-0">unanchored</Pill>
        )}
        {leverage > 0 ? (
          <span className="tnum shrink-0 text-2xs font-semibold text-fg-3">{formatLeverage(leverage)}</span>
        ) : null}
        <ChevronIcon />
      </span>
    </span>
  );
}

/** The tick that ties a child row to the group above it. */
function ChildRail() {
  return <span aria-hidden className="ml-2 h-px w-3 shrink-0 bg-line" />;
}

/**
 * A region of a clickable row that is not part of the click.
 *
 * Buttons inside a `role="button"` row need the click stopped *and* the keyboard
 * stopped — the row answers Enter and Space too, so a Close reached by tabbing
 * would fire the row's handler as well.
 */
export function StopClick({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

/**
 * The affordance for a click target that has no button of its own — a row whose
 * click opens a details sheet. Hidden until the row is hovered, so a still
 * blotter stays a table of figures.
 */
export function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 8 12"
      width="7"
      height="10"
      fill="none"
      aria-hidden
      className="shrink-0 text-fg-3 opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover/row:opacity-100"
    >
      <path
        d="M1.5 1.5L6 6l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Direction, as a chip rather than a word.
 *
 * The column is scanned, not read: a tinted capsule resolves at a glance from
 * across the desk, where two similarly-shaped words in green and red do not.
 */
export function SidePill({ isLong }: { isLong: boolean }) {
  const tone = isLong ? "var(--long-500)" : "var(--short-500)";

  return (
    <Pill
      color={tone}
      background={`color-mix(in srgb, ${tone} 12%, transparent)`}
      border={`color-mix(in srgb, ${tone} 26%, transparent)`}
      className="justify-self-start"
    >
      {isLong ? "Long" : "Short"}
    </Pill>
  );
}

interface RowActionProps {
  row: PrismQuote;
  actions: ReturnType<typeof usePositionActions>;
}

/**
 * What this row can actually do right now.
 *
 * The lifecycle decides, not the mutation's own pending flag: a row that has not
 * anchored on-chain has no `quoteId` to close (submitting `0` is how a Close
 * button turns into a silent rejection), and a row already closing should show
 * progress rather than a second button. A close also needs the session key's
 * delegation — a position opened in an earlier session would otherwise render a
 * Close that reverts on-chain after the spinner stops.
 *
 * The ladder itself is `resolvePositionIntent`, which the details sheet's footer
 * reads too, so the two surfaces cannot drift apart. This function only renders
 * the rung it lands on, at blotter size.
 */
function RowAction({ row, actions }: RowActionProps) {
  const intent = resolvePositionIntent(row, actions);

  if (intent.kind === "opening") {
    return <span className="prism-pulse text-2xs text-fg-3">opening…</span>;
  }

  if (intent.kind === "closing") {
    return <span className="prism-pulse text-2xs text-warn">closing…</span>;
  }

  if (intent.kind === "pending") {
    return <span className="text-2xs text-fg-3">pending</span>;
  }

  /* Not just "cancelling…": the solver may simply never answer, and the row
     that says only that reads as a dead end. The countdown names the moment the
     trader takes it back into their own hands, and the row flips to a live
     `Force cancel` on its own when it reaches zero. */
  if (intent.kind === "awaiting-cancel") {
    return (
      <span className="flex flex-col items-end gap-0.5 text-right" title={AWAITING_CANCEL_REASON}>
        <span className="prism-pulse text-2xs text-fg-3">cancelling…</span>
        {intent.remaining === undefined ? null : (
          <span className="tnum text-2xs text-fg-3">{`force in ${formatCountdown(intent.remaining)}`}</span>
        )}
      </span>
    );
  }

  if (intent.kind === "switch") {
    return (
      <Button
        size="sm"
        variant="ghost"
        title={switchReasonHint(intent.reason, actions.gate.targetName)}
        loading={actions.gate.isSwitching}
        onClick={() => void actions.gate.switchToDeployment()}
      >
        Switch
      </Button>
    );
  }

  if (intent.kind === "enable") {
    return (
      <Button size="sm" variant="ghost" loading={actions.delegation.isGranting} onClick={actions.delegation.grant}>
        Enable
      </Button>
    );
  }

  if (intent.kind === "cancel") {
    return intent.force ? (
      <Button size="sm" variant="danger" loading={actions.isCancelPending} onClick={actions.forceCancel}>
        Force cancel
      </Button>
    ) : (
      <Button size="sm" variant="secondary" loading={actions.isCancelPending} onClick={actions.cancel}>
        Cancel
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={actions.closeBlocked}
      title={actions.closeBlocked ? CLOSE_BLOCKED_REASON : undefined}
      loading={actions.isClosePending}
      onClick={actions.close}
    >
      Close
    </Button>
  );
}
