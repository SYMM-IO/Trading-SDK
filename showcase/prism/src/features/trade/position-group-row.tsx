"use client";

import { Button } from "@/components/button";
import { Pill, SolverPill } from "@/components/pill";
import { StatePill } from "@/components/state-pill";
import { DataRow } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE } from "@/config/deployments";
import { marketKey } from "@/features/markets/types";
import { useMergedMarkets } from "@/features/markets/use-merged-markets";
import { cn } from "@/lib/cn";
import {
  formatLeverage,
  formatPercent,
  formatPnl,
  formatPrice,
  formatRelativeTime,
  formatSize,
  formatUsd,
  marketLabel,
} from "@/lib/format";
import { PositionType } from "@symmio/trading-core";
import { useState } from "react";
import { BlotterRow, ChevronIcon, POSITION_COLUMNS, SidePill, StopClick } from "./blotter-row";
import { representativeQuote } from "./group-lifecycle";
import { PositionGroupDetailsModal } from "./position-group-details-modal";
import { PositionMarginModal } from "./position-margin-modal";
import { GroupExitsCell } from "./position-tpsl-cell";
import type { PrismGroup } from "./positions-provider";
import { resolveGroupIntent, useGroupActions } from "./use-group-actions";
import { useGroupMetrics } from "./use-group-metrics";

export interface PositionGroupRowProps {
  row: PrismGroup;
}

/**
 * One grouped position: several quotes in the same market and direction, folded
 * into a single row that expands to the quotes underneath it.
 *
 * The fold is the SDK's, not this row's. Every figure here comes from
 * `QuoteGroupMetrics` or `aggregateGroupUpnl` — including the two that are easy
 * to get wrong by hand. The average entry is quantity-weighted, so a 10-token
 * leg cannot pull it as hard as a 200-token one; and the P&L percentage divides
 * the group's total by its total open margin rather than averaging the children's
 * own percentages, which is the only reading that stays true when the legs carry
 * different leverage — the 1× and 2× pair on one market is exactly that case.
 *
 * ## Two gestures, two controls
 *
 * The caret unfolds the group; the row itself opens the group's details sheet,
 * the way a flat blotter row opens a position's. They used to be one gesture —
 * clicking anywhere unfolded — which made the fold the only thing a grouped row
 * could do, and left the group with no sheet of its own even though the figures
 * that matter most about it (its shared margin, its liquidation price, what
 * funding has cost it) exist at the group level and nowhere else.
 *
 * The controls inside the row stop the click, because a Close that also opened
 * a sheet behind its own confirmation toast would be one gesture doing two
 * things.
 */
export function PositionGroupRow({ row }: PositionGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [marginOpen, setMarginOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { byKey } = useMergedMarkets({ scope: "all" });
  const market = byKey.get(marketKey(row.family, Number(row.group.by.symbolId ?? 0n)));
  const actions = useGroupActions(row, market);
  const metrics = useGroupMetrics(row, market);

  const { group } = row;
  const name = market ? marketLabel(market.market.symbol, market.market.name) : `#${group.by.symbolId}`;
  const isLong = group.by.positionType === PositionType.LONG;
  const anchor = representativeQuote(group.quotes);

  return (
    <div className="relative">
      {/* Expanded, the family stripe spans the group *and* its children rather
          than repeating per row: one mark for one position is what tells the eye
          where the block ends, which a stack of identical per-row stripes cannot. */}
      {expanded ? (
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-0 z-10 w-[2px] rounded-full"
          style={{ background: FAMILY_PALETTE[row.family].base }}
        />
      ) : null}
      <DataRow
        columns={POSITION_COLUMNS}
        accent={expanded ? undefined : FAMILY_PALETTE[row.family].base}
        onClick={() => setDetailsOpen(true)}
        className="group/row"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <ExpandToggle
              expanded={expanded}
              count={group.metrics.quoteCount}
              onToggle={() => setExpanded((current) => !current)}
            />
            <span className="truncate font-display text-md font-semibold text-fg-0">{name}</span>
            {/* The count is the whole reason this row is not a position row.
                It carries the family tint so the fold reads as belonging to the
                deployment rather than as a generic badge. */}
            <Pill
              color={FAMILY_PALETTE[row.family].base}
              background={FAMILY_PALETTE[row.family].soft}
              border={FAMILY_PALETTE[row.family].border}
              className="shrink-0"
            >
              {`${group.metrics.quoteCount} quotes`}
            </Pill>
            {/* The row's own affordance, on the same hover rule as a flat row's:
                this one opens the group's sheet, the caret unfolds it. */}
            <ChevronIcon />
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <SolverPill family={row.family} className="shrink-0" />
            {metrics.leverage > 0 ? (
              <span
                className="tnum shrink-0 text-2xs font-semibold text-fg-2"
                title="Blended opening leverage across every quote in this group."
              >
                {formatLeverage(metrics.leverage)}
              </span>
            ) : null}
            <span className="truncate text-2xs text-fg-3">{row.account.name}</span>
          </span>
        </div>

        <SidePill isLong={isLong} />

        <div className="flex min-w-0 flex-col gap-0.5">
          <Numeric size="sm">{formatSize(metrics.size, market?.market.symbol)}</Numeric>
          <span className="tnum truncate text-2xs text-fg-3">{formatUsd(metrics.notional)}</span>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-baseline gap-1">
            <Numeric size="sm">
              {metrics.entryPrice === undefined ? "—" : formatPrice(metrics.entryPrice, market?.market.pricePrecision)}
            </Numeric>
            <span
              className="text-2xs text-fg-3"
              title="Quantity-weighted average across the group's quotes, so a larger leg counts for more."
            >
              avg
            </span>
          </span>
          <span className="tnum truncate text-2xs text-fg-3">
            {metrics.mark === undefined ? "mark —" : `mark ${formatPrice(metrics.mark, market?.market.pricePrecision)}`}
          </span>
        </div>

        {/* A partial fold is reported as partial. Summing the children that
            could be valued and printing it as the group's P&L would understate
            a loss the trader is actually carrying. */}
        <div
          className="flex flex-col gap-0.5"
          title={
            metrics.unvaluedCount > 0
              ? `${metrics.unvaluedCount} of these quotes have not settled an open price yet, so they are not in this total.`
              : undefined
          }
        >
          <Numeric size="sm" signed={metrics.upnl}>
            {metrics.upnl === undefined ? "—" : formatPnl(metrics.upnl)}
          </Numeric>
          <span className="tnum flex items-center gap-1 text-2xs text-fg-3">
            {metrics.upnlPercent === undefined ? null : formatPercent(metrics.upnlPercent)}
            {metrics.unvaluedCount > 0 ? <span className="text-warn">partial</span> : null}
          </span>
        </div>

        <StopClick className="min-w-0">
          <GroupExitsCell row={row} market={market} />
        </StopClick>

        <div className="flex min-w-0 flex-col items-start gap-1">
          <StatePill lifecycle={anchor?.lifecycle} status={anchor?.quoteStatus} />
          <span className="truncate text-2xs text-fg-3">
            {formatRelativeTime(Number(anchor?.statusModifyTimestamp ?? anchor?.createTimestamp ?? 0n))}
          </span>
        </div>

        <StopClick className="flex items-center justify-end gap-1.5">
          {/* One VA backs the whole group under `MARKET_DIRECTION` isolation, so
              margin is a group-level control here and there is nothing per-quote
              underneath it to top up separately. */}
          {group.vaAddress ? (
            <Button
              size="sm"
              variant="ghost"
              title="Add or remove the margin behind every quote in this group"
              onClick={() => setMarginOpen(true)}
            >
              Margin
            </Button>
          ) : null}
          <GroupAction row={row} actions={actions} />
        </StopClick>
      </DataRow>

      {expanded ? row.children.map((child) => <BlotterRow key={child.rowKey} row={child} depth="child" />) : null}

      {/* Mounted only while open: the sheet subscribes to funding, balances and
          a margin-risk fold per group, and a blotter of twenty rows must not pay
          for twenty sheets nobody is reading. */}
      {detailsOpen ? (
        <PositionGroupDetailsModal row={row} market={market} open onClose={() => setDetailsOpen(false)} />
      ) : null}

      {group.vaAddress ? (
        <PositionMarginModal
          deployment={row.deployment}
          account={row.account}
          virtualAccount={group.vaAddress}
          open={marginOpen}
          onClose={() => setMarginOpen(false)}
        />
      ) : null}
    </div>
  );
}

interface GroupActionProps {
  row: PrismGroup;
  actions: ReturnType<typeof useGroupActions>;
}

/**
 * What a grouped row can do right now.
 *
 * The ladder is `resolveGroupIntent`; this only renders the rung it lands on.
 * The close is one bulk request across every child, and while it runs the label
 * carries its quantity-weighted progress — a group close settles child by child,
 * so a single spinner would sit still through most of it.
 */
function GroupAction({ row, actions }: GroupActionProps) {
  const intent = resolveGroupIntent(actions);

  if (intent.kind === "opening") {
    return <span className="prism-pulse text-2xs text-fg-3">opening…</span>;
  }

  if (intent.kind === "closing") {
    return (
      <span className="prism-pulse text-2xs text-warn">
        {intent.progressPercent > 0 ? `closing ${Math.round(intent.progressPercent)}%` : "closing…"}
      </span>
    );
  }

  if (intent.kind === "pending") {
    return <span className="text-2xs text-fg-3">pending</span>;
  }

  if (intent.kind === "switch") {
    return (
      <Button
        size="sm"
        variant="ghost"
        title={`Authorising the session key is an on-chain transaction your wallet sends, so it has to be on ${actions.gate.targetName}.`}
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

  /* Some legs may not be closeable in this run — one already closing, one not
     anchored yet. The button says which it is rather than promising "all" and
     leaving a leg open without a word. */
  if (actions.isPartialClose) {
    return (
      <Button
        size="sm"
        variant="secondary"
        title="Some quotes in this group already have a close in flight or have not anchored yet. This closes the ones that can be closed and leaves the rest."
        onClick={actions.close}
      >
        Close rest
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      title={`Close all ${row.group.metrics.quoteCount} quotes in one request.`}
      onClick={actions.close}
    >
      Close all
    </Button>
  );
}

interface ExpandToggleProps {
  expanded: boolean;
  /** How many quotes are under the fold — the control says what it will reveal. */
  count: number;
  onToggle: () => void;
}

/**
 * The fold control.
 *
 * A real button rather than a decoration on a clickable row, because the row
 * now does something else: it opens the group's details sheet. Two behaviours
 * on one surface need two targets, and the caret is the one a trader already
 * reads as "unfold" — so it keeps the glyph and gains a hit area, a label and a
 * pressed state.
 *
 * It stops its own click and keypress: the row answers Enter and Space too, so
 * a caret reached by tabbing would otherwise unfold the group *and* open the
 * sheet on top of it. The glyph rotates rather than swapping, so the open and
 * closed states read as one control.
 */
function ExpandToggle({ expanded, count, onToggle }: ExpandToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? `Hide these ${count} quotes` : `Show these ${count} quotes`}
      title={expanded ? "Collapse this position" : "Expand to the quotes underneath"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn(
        "-ml-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-fg-2",
        "transition-colors duration-[var(--dur-fast)] hover:bg-bg-3 hover:text-fg-0",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
        expanded && "bg-bg-3 text-fg-0",
      )}
    >
      <svg
        viewBox="0 0 8 12"
        width="7"
        height="10"
        fill="none"
        aria-hidden
        className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]"
        style={{ transform: expanded ? "rotate(90deg)" : undefined }}
      >
        <path
          d="M1.5 1.5L6 6l-4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
