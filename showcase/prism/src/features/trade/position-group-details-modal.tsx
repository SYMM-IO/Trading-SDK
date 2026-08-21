"use client";

import { Button } from "@/components/button";
import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Modal } from "@/components/modal";
import { ChainPill, Pill, SolverPill } from "@/components/pill";
import { StatePill } from "@/components/state-pill";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE } from "@/config/deployments";
import type { PrismMarket } from "@/features/markets/types";
import { useMarkTick } from "@/features/prices/price-provider";
import {
  formatClock,
  formatDate,
  formatLeverage,
  formatPercent,
  formatPnl,
  formatPrice,
  formatRelativeTime,
  formatSize,
  formatUsd,
  fromWei,
  marketLabel,
  shortenAddress,
} from "@/lib/format";
import {
  calculateClosePlatformFee,
  calculateOpenPlatformFee,
  calculateQuoteLeverage,
  calculateQuotePnl,
  calculateQuoteUpnl,
  PositionType,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useMemo, useState } from "react";
import { GroupFundingSection } from "./group-funding-section";
import { representativeQuote } from "./group-lifecycle";
import { PositionMarginModal } from "./position-margin-modal";
import { PositionPriceRail } from "./position-price-rail";
import { PositionMarginSection, PositionRiskSection } from "./position-risk-section";
import { GroupExitsCell } from "./position-tpsl-cell";
import type { PrismGroup } from "./positions-provider";
import { resolveGroupIntent, useGroupActions } from "./use-group-actions";
import { useGroupFunding } from "./use-group-funding";
import { useGroupMetrics } from "./use-group-metrics";
import { useGroupRisk } from "./use-group-risk";

export interface PositionGroupDetailsModalProps {
  row: PrismGroup;
  /** The group's market, for precision, symbol and the solver's own market key. */
  market?: PrismMarket;
  open: boolean;
  onClose: () => void;
}

/**
 * Everything the SDK knows about one **grouped** position, on one sheet.
 *
 * The quote sheet behind a flat blotter row answers "what is this trade worth
 * and what has it cost". A grouped row was the one place that question had no
 * answer: expanding it listed the legs, and each leg had a sheet of its own, but
 * the *position* — the thing that shares a Virtual Account, one pot of margin
 * and one liquidation price — had none. A trader carrying three legs on one
 * market had to open three sheets and add up the figures by hand, and two of
 * those figures (margin and liquidation) are not additive at all: every leg's
 * sheet reports the same account-wide numbers, because they describe the VA
 * rather than the leg.
 *
 * So this is the same sheet at the level the position actually exists at. It
 * reads the same way and it renders through the same components — the margin,
 * risk and price-rail blocks are literally the quote sheet's — which is what
 * keeps a group and its children from disagreeing about their shared account.
 *
 * ## What is aggregated, and what is not
 *
 * - **Size, entry and P&L** are folded by the SDK: `QuoteGroupMetrics` for the
 *   quantity-weighted entry and the blended leverage, `aggregateGroupUpnl` for
 *   the P&L and its percentage. Neither is a mean of the children's displayed
 *   figures — a 10-token leg cannot pull the average as hard as a 200-token one,
 *   and the return divides by the group's own margin rather than averaging
 *   percentages that were each computed against different leverage.
 * - **Margin and liquidation** are not aggregated at all, because they were
 *   never per-leg: they belong to the Virtual Account the group resolves to,
 *   which under `MARKET_DIRECTION` isolation holds exactly this group's quotes.
 * - **Funding** is a sum with a completeness count, because the indexer answers
 *   per quote and a group's newest leg is routinely a few blocks ahead of it.
 *
 * Where a leg differs from its siblings — its own id, fill and P&L — the Legs
 * section says so, and the row's expansion is still where a leg is acted on
 * individually.
 */
export function PositionGroupDetailsModal({ row, market, open, onClose }: PositionGroupDetailsModalProps) {
  const { group } = row;
  const [marginOpen, setMarginOpen] = useState(false);

  const name = market ? marketLabel(market.market.symbol, market.market.name) : `#${group.by.symbolId}`;
  const positionType = group.by.positionType ?? group.quotes[0]?.positionType;
  const isLong = positionType === PositionType.LONG;
  const precision = market?.market.pricePrecision;

  /* Priced off the group's own deployment. The SDK's price hooks resolve their
     feed from the connected chain, which in a two-deployment book values a
     lowcap position against a majors tick. */
  const tick = useMarkTick(row.family, market?.market.name ?? "");
  const metrics = useGroupMetrics(row, market);
  const risk = useGroupRisk(row, market);
  const funding = useGroupFunding(row, market);
  const actions = useGroupActions(row, market);

  const anchor = representativeQuote(group.quotes);

  const originalSize = fromWei(group.metrics.quantity);
  /* Σ closed across the legs, taken as the difference the SDK already folded —
     `quantity − openQuantity` is exactly what a partial close moves. */
  const closedAmount = fromWei(group.metrics.quantity - group.metrics.openQuantity);

  const legs = useLegs(group.quotes, tick?.markPrice);
  const fees = useGroupFees(group.quotes);
  /* Realized P&L is measured against the price each closed portion closed at,
     so it needs no live feed — a pure core calculator answers it per leg. */
  const realized = useMemo(() => legs.reduce((total, leg) => total + leg.realized, 0), [legs]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        width="wide"
        eyebrow={`${row.account.name} · ${row.deployment.label}`}
        title={name}
        footer={
          <div className="flex items-center gap-2">
            <StatePill lifecycle={anchor?.lifecycle} status={anchor?.quoteStatus} />
            <div className="ml-auto flex items-center gap-2">
              {group.vaAddress ? (
                <Button size="md" variant="ghost" onClick={() => setMarginOpen(true)}>
                  Margin
                </Button>
              ) : null}
              <GroupSheetAction row={row} actions={actions} onDone={onClose} />
            </div>
          </div>
        }
      >
        <Header
          isLong={isLong}
          leverage={metrics.leverage}
          size={metrics.size}
          precision={market?.market.quantityPrecision}
          symbol={market?.market.symbol}
          notional={metrics.notional}
          upnl={metrics.upnl}
          upnlPercent={metrics.upnlPercent}
          unvaluedCount={metrics.unvaluedCount}
          quoteCount={group.metrics.quoteCount}
          family={row.family}
        />

        {/* The rail measures the distance from entry to liquidation, so it needs
            both. A group with a leg still waiting on its fill has no weighted
            entry to place, and an account the SDK cannot derive a liquidation
            price for has no scale — either way every figure is still below. */}
        {metrics.entryPrice !== undefined && risk.liquidationPrice > 0n ? (
          <PositionPriceRail
            entry={metrics.entryPrice}
            mark={metrics.mark}
            liquidation={fromWei(risk.liquidationPrice)}
            isLong={isLong}
            precision={precision}
          />
        ) : null}

        <DetailSection title="Position" note={`${group.metrics.quoteCount} quotes`}>
          <DetailRow
            label="Average open price"
            tip={{
              title: "Average open price",
              body: "Quantity-weighted across the group's quotes, so a larger leg counts for more. It is withheld while any leg is still waiting on a settled fill — an average over a half-known group is a guess.",
            }}
            value={
              <Numeric size="sm" tone={metrics.entryPrice === undefined ? "muted" : "strong"}>
                {metrics.entryPrice === undefined ? "—" : formatPrice(metrics.entryPrice, precision)}
              </Numeric>
            }
            sub={metrics.entryPrice === undefined ? "a leg has not filled yet" : "quantity-weighted"}
          />

          <DetailRow
            label="Mark price"
            value={
              <Numeric size="sm" tone="strong">
                {metrics.mark === undefined ? "—" : formatPrice(metrics.mark, precision)}
              </Numeric>
            }
            sub={metrics.mark === undefined ? "feed reconnecting" : undefined}
          />

          {/* The header compacts a large size to `1.2M`, which loses the
              decimals a close is actually submitted with. */}
          {metrics.size >= 10_000 ? (
            <DetailRow
              label="Exact size"
              value={
                <Numeric size="sm">
                  {metrics.size.toLocaleString("en-US", {
                    maximumFractionDigits: market?.market.quantityPrecision ?? 6,
                  })}
                </Numeric>
              }
            />
          ) : null}

          <DetailRow
            label="Closed amount"
            tip={{
              title: "Closed amount",
              body: "How much of the group's original size has already been closed, across every leg. The remaining size is what a group close plans against.",
            }}
            value={
              <Numeric size="sm" tone={closedAmount > 0 ? "strong" : "muted"}>
                {formatSize(closedAmount, market?.market.symbol)}
              </Numeric>
            }
            sub={closedAmount > 0 ? `of ${formatSize(originalSize, market?.market.symbol)}` : undefined}
          />

          {closedAmount > 0 ? (
            <DetailRow
              label="Realized P&L"
              tip={{
                title: "Realized P&L",
                body: "Profit or loss on the portions already closed, summed across the legs and measured against the price each of them closed at.",
              }}
              value={
                <Numeric size="sm" signed={realized}>
                  {formatPnl(realized)}
                </Numeric>
              }
              sub="on the closed portions"
            />
          ) : null}

          <DetailRow label="Exits" value={<GroupExitsCell row={row} market={market} />} />
        </DetailSection>

        <LegsSection legs={legs} symbol={market?.market.symbol} precision={precision} />

        {/* The live legs, not the frozen ones. These sit directly above the
            account's own margin figures, which are also live, so using the
            at-open snapshot here would print two totals that disagree on a
            partially closed group with no way to tell why. */}
        <PositionMarginSection
          locked={group.metrics.lockedValues}
          title="This group's margin"
          note="locked now · all legs"
        />

        <PositionRiskSection
          risk={risk}
          precision={precision}
          onEditMargin={group.vaAddress ? () => setMarginOpen(true) : undefined}
        />

        <GroupFundingSection
          funding={funding}
          fees={fees}
          hasClosed={closedAmount > 0}
          isLong={isLong}
          deployment={row.deployment}
        />

        <DetailSection title="Provenance">
          <QuoteIdsRow quotes={group.quotes} />

          <DetailRow
            label="Opened"
            value={<Numeric size="sm">{formatDate(oldest(group.quotes))}</Numeric>}
            sub={
              oldest(group.quotes) > 0
                ? `${formatClock(oldest(group.quotes))} · ${formatRelativeTime(oldest(group.quotes))}`
                : undefined
            }
          />

          <DetailRow
            label="Last update"
            value={<Numeric size="sm">{formatRelativeTime(newest(group.quotes))}</Numeric>}
            sub="across every leg"
          />

          <DetailRow label="Solver" value={<SolverPill family={row.family} variant="name" />} />

          <DetailRow label="Settles on" value={<ChainPill family={row.family} />} />

          <DetailRow
            label="Sub-account"
            value={<Numeric size="sm">{shortenAddress(row.account.address)}</Numeric>}
            sub={row.account.name}
            action={<CopyAction value={row.account.address} label="Sub-account address" />}
          />

          {group.vaAddress ? (
            <DetailRow
              label="Virtual Account"
              tip={{
                title: "Virtual Account",
                body: "Under this account's isolation the protocol allocates one account per market per direction, and every quote in this group lives in it. It holds their shared margin and is liquidated as a whole — which is why the figures above are the group's and not any single leg's.",
              }}
              value={<Numeric size="sm">{shortenAddress(group.vaAddress)}</Numeric>}
              action={<CopyAction value={group.vaAddress} label="Virtual Account address" />}
            />
          ) : null}
        </DetailSection>
      </Modal>

      {group.vaAddress ? (
        <PositionMarginModal
          deployment={row.deployment}
          account={row.account}
          virtualAccount={group.vaAddress}
          open={marginOpen}
          onClose={() => setMarginOpen(false)}
        />
      ) : null}
    </>
  );
}

interface HeaderProps {
  isLong: boolean;
  leverage: number;
  size: number;
  /** The market's quantity precision — the size a close is actually submitted with. */
  precision?: number;
  symbol?: string;
  notional: number;
  /** `undefined` while nothing in the group could be valued — never rendered as `0`. */
  upnl?: number;
  upnlPercent?: number;
  /** Legs left out of the P&L because their open price has not settled. */
  unvaluedCount: number;
  quoteCount: number;
  family: PrismGroup["family"];
}

/**
 * The two facts a trader opens this sheet for: what they hold across the group,
 * and what it is worth right now.
 *
 * A partial fold says so. Summing only the legs that could be valued and
 * printing it as the group's P&L would understate a loss the trader is actually
 * carrying, so the count that is missing is named next to the figure.
 */
function Header({
  isLong,
  leverage,
  size,
  precision,
  symbol,
  notional,
  upnl,
  upnlPercent,
  unvaluedCount,
  quoteCount,
  family,
}: HeaderProps) {
  const tone = isLong ? "var(--long-500)" : "var(--short-500)";

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <Pill
            color={tone}
            background={`color-mix(in srgb, ${tone} 12%, transparent)`}
            border={`color-mix(in srgb, ${tone} 26%, transparent)`}
          >
            {isLong ? "Long" : "Short"}
          </Pill>
          {leverage > 0 ? (
            <span className="tnum text-2xs font-semibold text-fg-2" title="Blended opening leverage across every leg.">
              {formatLeverage(leverage)}
            </span>
          ) : null}
          <SolverPill family={family} />
          <Pill
            color={FAMILY_PALETTE[family].base}
            background={FAMILY_PALETTE[family].soft}
            border={FAMILY_PALETTE[family].border}
          >
            {`${quoteCount} quotes`}
          </Pill>
        </span>

        {/* The exact size, not the compacted one. This is the number a group
            close plans against, and `215 SYMM` for a position of 214.892016 is
            the kind of rounding a trader discovers at the worst moment. */}
        <Numeric size="lg" tone="strong">
          {size >= 10_000
            ? formatSize(size, symbol)
            : `${size.toLocaleString("en-US", { maximumFractionDigits: precision ?? 6 })}${symbol ? ` ${symbol}` : ""}`}
        </Numeric>
        <span className="tnum text-2xs text-fg-3">{formatUsd(notional)} at mark</span>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <span className="text-2xs font-semibold tracking-[0.12em] text-fg-3 uppercase">Unrealized P&amp;L</span>
        <Numeric size="xl" signed={upnl}>
          {upnl === undefined ? "—" : formatPnl(upnl)}
        </Numeric>
        {upnl === undefined ? (
          <span className="text-2xs text-fg-3">waiting on a mark</span>
        ) : (
          <span className="tnum flex items-center gap-1.5 text-2xs text-fg-3">
            {upnlPercent === undefined ? null : formatPercent(upnlPercent, { signed: true })}
            {unvaluedCount > 0 ? (
              <span
                className="text-warn"
                title={`${unvaluedCount} legs have not settled an open price, so they are not in this total.`}
              >
                partial
              </span>
            ) : null}
          </span>
        )}
      </div>
    </div>
  );
}

/** One leg of the group, with the figures that differ from its siblings'. */
interface Leg {
  /** The quote's own stable key — unique within the group. */
  key: string;
  quoteId?: bigint;
  /** Open size, i.e. what a close still has to name. */
  openQuantity: number;
  /** Settled fill price, or the requested one while it is still opening. */
  entry: number;
  isFilled: boolean;
  leverage: number;
  /** `undefined` while this leg has no mark or no settled fill. */
  upnl?: number;
  /** Realized P&L on this leg's closed portion, in dollars. */
  realized: number;
}

/**
 * The per-leg figures behind the aggregates.
 *
 * A group's legs are opened at different moments and different sizes, which is
 * the whole reason the fold exists — and also the reason it hides something: a
 * group at break-even can be one leg well up and another well down. The blotter
 * expansion shows the same legs as rows a trader can act on; this shows them as
 * the arithmetic behind the number above.
 */
function useLegs(quotes: readonly UnifiedQuote[], markPrice?: string): Leg[] {
  return useMemo(
    () =>
      quotes.map((quote) => {
        /* Leverage comes off the margin the quote locked, so it is known without
           a price — an unpriced leg still says how leveraged it is. */
        const leverage = calculateQuoteLeverage({
          quantity: quote.quantity,
          requestedOpenPrice: quote.requestedOpenPrice,
          openedPrice: quote.openedPrice,
          lockedValues: quote.initialLockedValues ?? quote.lockedValues,
        });

        /* `0n` and `undefined` both mean "no fill yet" — the first is an
           on-chain row before partyB settles it, the second an off-chain one.
           Collapsing them is what keeps an unfilled leg from valuing its whole
           notional as profit against an entry of zero. */
        const settledOpen = quote.openedPrice !== undefined && quote.openedPrice !== 0n ? quote.openedPrice : undefined;

        const upnl =
          markPrice !== undefined && settledOpen !== undefined
            ? Number(
                calculateQuoteUpnl({
                  markPrice,
                  positionType: quote.positionType,
                  quantity: quote.quantity,
                  closedAmount: quote.closedAmount ?? 0n,
                  openedPrice: settledOpen,
                  leverage,
                }).upnl,
              )
            : undefined;

        const closedAmount = quote.closedAmount ?? 0n;
        const realized =
          closedAmount > 0n
            ? Number(
                calculateQuotePnl({
                  positionType: quote.positionType,
                  closedAmount,
                  closedPrice: quote.avgClosedPrice ?? 0n,
                  openedPrice: quote.openedPrice ?? 0n,
                  leverage,
                }).pnl,
              )
            : 0;

        return {
          key: quote.key,
          quoteId: quote.quoteId,
          openQuantity: fromWei(quote.openQuantity),
          entry: fromWei(settledOpen ?? quote.requestedOpenPrice),
          isFilled: settledOpen !== undefined,
          leverage: Number(leverage),
          upnl,
          realized,
        };
      }),
    [quotes, markPrice],
  );
}

/**
 * Σ platform fees across the group's legs.
 *
 * The SDK's `useQuotePlatformFee` answers this for one quote, and a hook cannot
 * be called in a loop — so the same two pure core calculators are folded here
 * instead. Fees are per-quote by construction: each leg was charged on its own
 * size at its own fill price.
 */
function useGroupFees(quotes: readonly UnifiedQuote[]): { openFee: bigint; closeFee: bigint } {
  return useMemo(() => {
    let openFee = 0n;
    let closeFee = 0n;

    for (const quote of quotes) {
      openFee += calculateOpenPlatformFee({
        quantity: quote.quantity,
        openedPrice: quote.openedPrice ?? 0n,
        openFeeRate: quote.tradingFee ?? 0n,
      });

      const closedAmount = quote.closedAmount ?? 0n;
      if (closedAmount > 0n) {
        closeFee += calculateClosePlatformFee({
          quantity: closedAmount,
          closePrice: quote.avgClosedPrice ?? 0n,
          closeFeeRate: quote.closeFee ?? 0n,
        });
      }
    }

    return { openFee, closeFee };
  }, [quotes]);
}

interface LegsSectionProps {
  legs: readonly Leg[];
  symbol?: string;
  precision?: number;
}

/** The legs, newest first — the same order the row's expansion lists them in. */
function LegsSection({ legs, symbol, precision }: LegsSectionProps) {
  return (
    <DetailSection title="Legs" note="each quote's own P&L">
      {legs.map((leg) => (
        <DetailRow
          key={leg.key}
          label={
            leg.quoteId === undefined || leg.quoteId === 0n ? (
              <span className="text-fg-3">unanchored</span>
            ) : (
              <span className="tnum">{`#${leg.quoteId}`}</span>
            )
          }
          value={
            <Numeric size="sm" signed={leg.upnl}>
              {leg.upnl === undefined ? "—" : formatPnl(leg.upnl)}
            </Numeric>
          }
          sub={
            <>
              {formatSize(leg.openQuantity, symbol)}
              {leg.isFilled ? ` @ ${formatPrice(leg.entry, precision)}` : " · not filled"}
              {leg.leverage > 0 ? ` · ${formatLeverage(leg.leverage)}` : null}
            </>
          }
        />
      ))}
    </DetailSection>
  );
}

interface QuoteIdsRowProps {
  quotes: readonly UnifiedQuote[];
}

/**
 * The group's on-chain ids, as one row.
 *
 * A grouped position is several quotes, so "the quote id" is a list — and the
 * list is what a trader pastes into an explorer or hands to support. It is
 * displayed compactly and copied in full, because the two have different jobs.
 */
function QuoteIdsRow({ quotes }: QuoteIdsRowProps) {
  const ids = quotes
    .map((quote) => quote.quoteId)
    .filter((id): id is bigint => id !== undefined && id > 0n)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  if (ids.length === 0) {
    return (
      <DetailRow
        label="Quote IDs"
        value={
          <Numeric size="sm" tone="muted">
            not on-chain yet
          </Numeric>
        }
      />
    );
  }

  /* A run of consecutive ids is how a multi-leg group usually looks, and
     `17854–17856` is both shorter and more legible than the three of them. */
  const isRun = ids.length > 2 && ids[ids.length - 1]! - ids[0]! === BigInt(ids.length - 1);
  const display = isRun ? `${ids[0]}–${ids[ids.length - 1]}` : ids.join(" · ");

  return (
    <DetailRow
      label={ids.length === 1 ? "Quote ID" : "Quote IDs"}
      value={
        <Numeric size="sm" tone="strong" className="truncate">
          {display}
        </Numeric>
      }
      sub={ids.length === quotes.length ? undefined : `${quotes.length - ids.length} not on-chain yet`}
      action={<CopyAction value={ids.join(", ")} label={ids.length === 1 ? "Quote ID" : "Quote IDs"} />}
    />
  );
}

interface GroupSheetActionProps {
  row: PrismGroup;
  actions: ReturnType<typeof useGroupActions>;
  /** Closes the sheet once the write is away — the row behind it takes over. */
  onDone: () => void;
}

/**
 * The sheet's one call to action, on the same ladder as the grouped row's.
 *
 * Both render `resolveGroupIntent`, so the sheet cannot offer a close the row
 * correctly refuses — the sheet is where a trader goes when they are already
 * unsure. Only the size changes.
 */
function GroupSheetAction({ row, actions, onDone }: GroupSheetActionProps) {
  const intent = resolveGroupIntent(actions);

  if (intent.kind === "opening") {
    return <span className="prism-pulse text-sm text-fg-3">opening…</span>;
  }

  if (intent.kind === "closing") {
    return (
      <span className="prism-pulse text-sm text-warn">
        {intent.progressPercent > 0 ? `closing ${Math.round(intent.progressPercent)}%` : "closing…"}
      </span>
    );
  }

  if (intent.kind === "pending") {
    return <span className="text-sm text-fg-3">pending</span>;
  }

  if (intent.kind === "switch") {
    return (
      <Button
        size="md"
        variant="secondary"
        title={`Authorising the session key is an on-chain transaction your wallet sends, so it has to be on ${actions.gate.targetName}.`}
        loading={actions.gate.isSwitching}
        onClick={() => void actions.gate.switchToDeployment()}
      >
        Switch network
      </Button>
    );
  }

  if (intent.kind === "enable") {
    return (
      <Button size="md" variant="secondary" loading={actions.delegation.isGranting} onClick={actions.delegation.grant}>
        Enable trading
      </Button>
    );
  }

  /* Some legs may not be closeable in this run — one already closing, one not
     anchored yet. The button says which it is rather than promising "all" and
     leaving a leg open without a word. */
  return (
    <Button
      size="md"
      variant="primary"
      title={
        actions.isPartialClose
          ? "Some quotes in this group already have a close in flight or have not anchored yet. This closes the ones that can be closed and leaves the rest."
          : `Close all ${row.group.metrics.quoteCount} quotes in one request.`
      }
      onClick={() => {
        actions.close();
        onDone();
      }}
    >
      {actions.isPartialClose ? "Close the rest" : "Close position"}
    </Button>
  );
}

/** When the oldest leg was opened — the moment the position started. */
function oldest(quotes: readonly UnifiedQuote[]): number {
  let result = 0;
  for (const quote of quotes) {
    const created = Number(quote.createTimestamp ?? 0n);
    if (created > 0 && (result === 0 || created < result)) result = created;
  }
  return result;
}

/** The most recent activity anywhere in the group. */
function newest(quotes: readonly UnifiedQuote[]): number {
  let result = 0;
  for (const quote of quotes) {
    const changed = Number(quote.statusModifyTimestamp ?? quote.createTimestamp ?? 0n);
    if (changed > result) result = changed;
  }
  return result;
}
