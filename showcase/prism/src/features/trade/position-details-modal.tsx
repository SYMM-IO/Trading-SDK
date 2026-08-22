"use client";

import { Button } from "@/components/button";
import { CopyAction, DetailRow, DetailSection } from "@/components/detail-list";
import { Modal } from "@/components/modal";
import { ChainPill, Pill, SolverPill } from "@/components/pill";
import { StatePill } from "@/components/state-pill";
import { Numeric } from "@/components/value";
import type { PrismMarket } from "@/features/markets/types";
import {
  formatClock,
  formatCountdown,
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
import { calculateQuotePnl, isActivePosition, OrderType, PositionType } from "@symmio/trading-core";
import { useQuotePlatformFee } from "@symmio/trading-react";
import { useEffect, useState } from "react";
import { PositionFundingHistoryRow } from "./position-funding-history";
import { PositionLimitCloseModal } from "./position-limit-close-modal";
import { PositionMarginModal } from "./position-margin-modal";
import { PositionPriceRail } from "./position-price-rail";
import { PositionMarginSection, PositionRiskSection } from "./position-risk-section";
import { PositionTpSlCell } from "./position-tpsl-cell";
import type { PrismQuote } from "./positions-provider";
import {
  AWAITING_CANCEL_CLOSE_REASON,
  AWAITING_CANCEL_REASON,
  CLOSE_BLOCKED_REASON,
  LIMIT_CLOSE_HINT,
  resolvePositionIntent,
  restingCloseOf,
  switchReasonHint,
  usePositionActions,
} from "./use-position-actions";
import { usePositionFunding } from "./use-position-funding";
import { usePositionRisk } from "./use-position-risk";
import { useQuoteMetrics } from "./use-quote-metrics";

export interface PositionDetailsModalProps {
  row: PrismQuote;
  /** The row's market, for precision, symbol and the solver's own market key. */
  market?: PrismMarket;
  open: boolean;
  onClose: () => void;
}

/**
 * Everything the SDK knows about one position, on one sheet.
 *
 * The blotter row is deliberately a scan surface — eight columns a trader reads
 * across a desk. This is the read surface behind it: the figures that only
 * matter once, when a decision is being made, and that would each cost a column
 * nobody looks at the rest of the time.
 *
 * ## Nothing here branches on which solver served the position
 *
 * Every difference between a majors position and a lowcap one is answered by
 * something the *row* carries, not by its deployment:
 *
 * - **The liquidation domain** is the account holding the collateral, which the
 *   quote names in `vaAddress` (isolated) or `partyA` (cross-margin). That single
 *   test decides whether the margin figures describe this trade or the whole book.
 * - **Conditional orders** exist wherever the resolved solver declares a handler,
 *   which `useTpSlSupported` answers — so the TP/SL row is a control on one
 *   deployment and an explanation on the other.
 * - **Settled funding** needs an on-chain quote id, so an optimistic row reports
 *   it as unknown rather than as zero.
 * - **The market's own key** for the funding endpoint differs by solver kind, and
 *   `solverMarketKey` resolves it — asking the wrong one returns `{}`, which
 *   reads as "no funding" rather than as a miss.
 *
 * Where a fact is genuinely unavailable the sheet says what stands in its place
 * instead of leaving a blank, because a dash is indistinguishable from a bug.
 */
export function PositionDetailsModal({ row, market, open, onClose }: PositionDetailsModalProps) {
  const { quote } = row;
  const [marginOpen, setMarginOpen] = useState(false);
  const [limitCloseOpen, setLimitCloseOpen] = useState(false);

  const name = market ? marketLabel(market.market.symbol, market.market.name) : `#${quote.symbolId}`;
  const isLong = quote.positionType === PositionType.LONG;
  const precision = market?.market.pricePrecision;

  /* Priced off the row's own deployment. The SDK's `useQuoteUpnlAndPnl`
     resolves its feed from the connected chain, which in a two-deployment book
     values a lowcap position against a majors tick. */
  const metrics = useQuoteMetrics(row, market);
  const mark = metrics.mark;
  const fees = useQuotePlatformFee({ quote });
  const funding = usePositionFunding(row, market);
  const risk = usePositionRisk(row);
  const actions = usePositionActions(row, market);
  const resting = restingCloseOf(quote);

  /* `0n` and `undefined` both mean "no fill yet" — the first is an on-chain row
     before partyB settles it, the second an off-chain one. Collapsing them is
     what keeps a resting order from reporting an open price of `$0.00`. */
  const settledOpen = quote.openedPrice !== undefined && quote.openedPrice !== 0n ? quote.openedPrice : undefined;
  const isFilled = settledOpen !== undefined;
  const openPrice = fromWei(settledOpen ?? quote.requestedOpenPrice);
  const size = fromWei(quote.openQuantity);
  const originalSize = fromWei(quote.quantity);
  const closedAmount = fromWei(quote.closedAmount ?? 0n);
  /* Value at the live mark, falling back to entry: a notional that reads `—`
     while the feed reconnects is worse than one priced a minute ago. */
  const notional = size * (mark ?? openPrice);

  /* Realized P&L is measured against the price the closed portion closed at, so
     it needs no live feed at all — a pure core calculator answers it. */
  const realized = calculateQuotePnl({
    positionType: quote.positionType,
    closedAmount: quote.closedAmount ?? 0n,
    closedPrice: quote.avgClosedPrice ?? 0n,
    openedPrice: quote.openedPrice ?? 0n,
    leverage: String(metrics.leverage),
  });

  /* Only worth a row when the two differ *at the precision the market quotes*.
     Comparing the raw bigints instead surfaces the row for a difference in the
     eighteenth decimal, which renders as two identical prices — and the
     notification replay can rewrite `openedPrice` from a hedger feed while
     `initialOpenedPrice` stays chain-sourced, so that happens routinely.
     Truncated, not rounded, so the row does not flip at the boundary. */
  const hasRepricedOpen =
    quote.initialOpenedPrice !== undefined &&
    quote.initialOpenedPrice !== 0n &&
    settledOpen !== undefined &&
    truncateTo(fromWei(quote.initialOpenedPrice), precision) !== truncateTo(fromWei(settledOpen), precision);

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
            <StatePill lifecycle={quote.lifecycle} status={quote.quoteStatus} />
            <div className="ml-auto flex items-center gap-2">
              {quote.vaAddress && isActivePosition(quote) ? (
                <Button size="md" variant="ghost" onClick={() => setMarginOpen(true)}>
                  Margin
                </Button>
              ) : null}
              <SheetAction
                actions={actions}
                row={row}
                onDone={onClose}
                canLimitClose={Boolean(market)}
                onLimitClose={() => setLimitCloseOpen(true)}
              />
            </div>
          </div>
        }
      >
        <Header
          isLong={isLong}
          leverage={metrics.leverage}
          size={size}
          precision={market?.market.quantityPrecision}
          symbol={market?.market.symbol}
          notional={notional}
          upnl={metrics.upnl}
          upnlPercent={metrics.upnlPercent}
          family={row.family}
        />

        {/* The rail measures the distance from entry to liquidation, so it needs
            both: a resting order has no entry, and a position the SDK cannot
            derive a liquidation price for has no scale. Either way the Position
            section below still carries every figure, so the rail simply goes
            rather than rendering an empty track. */}
        {isFilled && risk.liquidationPrice > 0n ? (
          <PositionPriceRail
            entry={openPrice}
            mark={mark}
            liquidation={risk.liquidationPrice > 0n ? fromWei(risk.liquidationPrice) : undefined}
            isLong={isLong}
            precision={precision}
          />
        ) : null}

        <DetailSection title="Position">
          <DetailRow
            label={isFilled ? "Open price" : "Requested price"}
            value={
              <Numeric size="sm" tone="strong">
                {isFilled || quote.orderType === OrderType.LIMIT ? formatPrice(openPrice, precision) : "at market"}
              </Numeric>
            }
            sub={isFilled ? undefined : "not filled yet"}
          />

          {hasRepricedOpen ? (
            <DetailRow
              label="Initial open price"
              tip={{
                title: "Initial open price",
                body: "The price this quote was first opened at. It differs from the open price when the position has since been re-priced on-chain.",
              }}
              value={<Numeric size="sm">{formatPrice(fromWei(quote.initialOpenedPrice ?? 0n), precision)}</Numeric>}
            />
          ) : null}

          <DetailRow
            label="Mark price"
            value={
              <Numeric size="sm" tone="strong">
                {mark === undefined ? "—" : formatPrice(mark, precision)}
              </Numeric>
            }
            sub={mark === undefined ? "feed reconnecting" : undefined}
          />

          {/* Where the close is waiting, and for how much. The pill in the
              footer says a close is pending; this is the level it rests at,
              which is the figure that decides whether to leave it or cancel. */}
          {resting ? (
            <DetailRow
              label="Resting close"
              tip={{
                title: "Resting close",
                body: resting.isLimit
                  ? "A limit close waits on-chain at this price until the solver fills it, you cancel it, or its deadline passes. The position stays open — priced, and paying or earning funding — until then."
                  : "A market close the solver has accepted but not yet filled on-chain. If it stalls, it can be cancelled like any resting close.",
              }}
              value={
                <Numeric size="sm" tone="strong">
                  {formatPrice(fromWei(resting.price), precision)}
                </Numeric>
              }
              sub={`${formatSize(fromWei(resting.quantity), market?.market.symbol)} of ${formatSize(size, market?.market.symbol)} · ${resting.isLimit ? "limit" : "market"}${
                actions.closeExpiresIn === undefined
                  ? ""
                  : actions.closeExpiresIn === 0
                    ? " · expired"
                    : ` · expires in ${formatCountdown(actions.closeExpiresIn)}`
              }`}
            />
          ) : null}

          {/* The header compacts a large size to `1.2M`, which loses the
              decimals a close is actually submitted with. */}
          {size >= 10_000 ? (
            <DetailRow
              label="Exact size"
              value={
                <Numeric size="sm">
                  {size.toLocaleString("en-US", { maximumFractionDigits: market?.market.quantityPrecision ?? 6 })}
                </Numeric>
              }
            />
          ) : null}

          <DetailRow
            label="Closed amount"
            tip={{
              title: "Closed amount",
              body: "How much of the original size has already been closed. The remaining size is what a close submits.",
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
                body: "Profit or loss on the portion already closed, measured against the price it closed at.",
              }}
              value={
                <Numeric size="sm" signed={Number(realized.pnl)}>
                  {formatPnl(Number(realized.pnl))}
                </Numeric>
              }
              sub={
                Number(realized.pnlPercent) === 0
                  ? undefined
                  : formatPercent(Number(realized.pnlPercent), { signed: true })
              }
            />
          ) : null}

          <DetailRow label="Exits" value={<PositionTpSlCell row={row} market={market} />} />

          <DetailRow
            label="Order type"
            tip={{
              title: "Order type",
              body: "The type of the request currently outstanding. The contract overwrites this field when a close is requested, so on a closing position it describes the close rather than the open.",
            }}
            value={<Pill>{quote.orderType === OrderType.LIMIT ? "Limit" : "Market"}</Pill>}
          />
        </DetailSection>

        {/* The live legs, not the frozen ones. These sit directly above the
            account's own margin figures, which are also live, so using the
            at-open snapshot here would print two totals that disagree on a
            partially closed position with no way to tell why. */}
        <PositionMarginSection locked={quote.lockedValues} />

        <PositionRiskSection
          risk={risk}
          precision={precision}
          onEditMargin={quote.vaAddress ? () => setMarginOpen(true) : undefined}
        />

        <FundingSection
          row={row}
          funding={funding}
          fees={fees}
          hasClosed={closedAmount > 0}
          isLong={isLong}
          deployment={row.deployment}
        />

        <DetailSection title="Provenance">
          <DetailRow
            label="Quote ID"
            value={
              <Numeric size="sm" tone={actions.isAnchored ? "strong" : "muted"}>
                {actions.isAnchored ? String(quote.quoteId) : "not on-chain yet"}
              </Numeric>
            }
            action={actions.isAnchored ? <CopyAction value={String(quote.quoteId)} label="Quote ID" /> : undefined}
          />

          <DetailRow
            label="Opened"
            value={<Numeric size="sm">{formatDate(Number(quote.createTimestamp ?? 0n))}</Numeric>}
            sub={
              quote.createTimestamp
                ? `${formatClock(Number(quote.createTimestamp))} · ${formatRelativeTime(Number(quote.createTimestamp))}`
                : undefined
            }
          />

          <DetailRow
            label="Last update"
            value={<Numeric size="sm">{formatRelativeTime(Number(quote.statusModifyTimestamp ?? 0n))}</Numeric>}
          />

          <DetailRow label="Solver" value={<SolverPill family={row.family} variant="name" />} />

          <DetailRow label="Settles on" value={<ChainPill family={row.family} />} />

          <DetailRow
            label="Sub-account"
            value={<Numeric size="sm">{shortenAddress(row.account.address)}</Numeric>}
            sub={row.account.name}
            action={<CopyAction value={row.account.address} label="Sub-account address" />}
          />

          {quote.vaAddress ? (
            <DetailRow
              label="Virtual Account"
              tip={{
                title: "Virtual Account",
                body: "An isolated position gets its own account on-chain. It holds this position's margin and is liquidated on its own, independently of every other position on the sub-account.",
              }}
              value={<Numeric size="sm">{shortenAddress(quote.vaAddress)}</Numeric>}
              action={<CopyAction value={quote.vaAddress} label="Virtual Account address" />}
            />
          ) : null}
        </DetailSection>
      </Modal>

      {quote.vaAddress ? (
        <PositionMarginModal
          deployment={row.deployment}
          account={row.account}
          virtualAccount={quote.vaAddress}
          open={marginOpen}
          onClose={() => setMarginOpen(false)}
        />
      ) : null}

      {limitCloseOpen && market ? (
        <PositionLimitCloseModal row={row} market={market} open onClose={() => setLimitCloseOpen(false)} />
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
  /** `undefined` while the row's market has not ticked — never rendered as `0`. */
  upnl?: number;
  upnlPercent?: number;
  family: PrismQuote["family"];
}

/**
 * The two facts a trader opens this sheet for: what they hold, and what it is
 * worth right now. Everything below is the evidence behind the second one.
 */
function Header({ isLong, leverage, size, precision, symbol, notional, upnl, upnlPercent, family }: HeaderProps) {
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
            <span className="tnum text-2xs font-semibold text-fg-2">{formatLeverage(leverage)}</span>
          ) : null}
          <SolverPill family={family} />
        </span>

        {/* The exact size, not the compacted one. This is the number a close
            submits, and `215 SYMM` for a position of 214.892016 is the kind of
            rounding a trader discovers at the worst possible moment. */}
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
        {upnlPercent === undefined ? (
          <span className="text-2xs text-fg-3">waiting on a mark</span>
        ) : (
          <span className="tnum text-2xs text-fg-3">{formatPercent(upnlPercent, { signed: true })}</span>
        )}
      </div>
    </div>
  );
}

interface FundingSectionProps {
  row: PrismQuote;
  funding: ReturnType<typeof usePositionFunding>;
  fees: ReturnType<typeof useQuotePlatformFee>;
  hasClosed: boolean;
  isLong: boolean;
  deployment: PrismQuote["deployment"];
}

/** What each non-numeric settled state should say, in the row's own voice. */
const SETTLED_NOTE: Record<Exclude<ReturnType<typeof usePositionFunding>["settledState"], "known">, string> = {
  "off-chain": "not on-chain yet",
  loading: "…",
  error: "read failed",
  "not-indexed": "not indexed yet",
  "no-indexer": "no indexer",
};

/**
 * What holding this position has cost — settled, upcoming, and in fees.
 *
 * Settled funding and the next epoch's estimate sit together because they are
 * the same quantity at two points in time. They are *not* rendered the same way,
 * and the reason is worth stating: the settled figure comes from the SDK with a
 * documented income-positive sign, while the sign of the solver's published
 * next-epoch rate is contradicted by the contract it settles against. So the
 * estimate is shown as a magnitude with the direction spelled out in words,
 * which is true under either convention — a signed dollar figure would be
 * exactly backwards under one of them, and no reader could tell which.
 */
function FundingSection({ row, funding, fees, hasClosed, isLong, deployment }: FundingSectionProps) {
  const side = isLong ? "Long" : "Short";
  const state = funding.settledState;

  return (
    <DetailSection title="Funding & fees">
      <DetailRow
        label="Net funding"
        tip={{
          title: "Net funding",
          body: "Funding received minus funding paid over this position's life, as settled on-chain and indexed by the analytics subgraph. Positive means the position has earned funding. It covers charges already made — funding accrued since the last one is indexed nowhere.",
        }}
        value={
          state === "known" ? (
            <Numeric size="sm" signed={fromWei(funding.netSettled)}>
              {formatUsd(fromWei(funding.netSettled), { exact: true, signed: true, maxDecimals: 4 })}
            </Numeric>
          ) : (
            <Numeric size="sm" tone="muted">
              {SETTLED_NOTE[state]}
            </Numeric>
          )
        }
        sub={
          state === "known" && funding.netSettled !== 0n
            ? `${formatUsd(fromWei(funding.received), { exact: true, maxDecimals: 4 })} in · ${formatUsd(fromWei(funding.paid), { exact: true, maxDecimals: 4 })} out`
            : state === "no-indexer"
              ? `${deployment.chainName} has no analytics subgraph yet`
              : undefined
        }
      />

      <PositionFundingHistoryRow row={row} />

      <DetailRow
        label="Upcoming funding"
        tip={{
          title: "Upcoming funding",
          body: "An estimate for the epoch now running: the solver's next-epoch rate for this side, applied to the position's notional at the current mark. It moves with the price until it settles.",
        }}
        value={
          funding.upcoming === undefined ? (
            <Numeric size="sm" tone="muted">
              —
            </Numeric>
          ) : (
            <Numeric size="sm" tone={funding.isUpcomingIncome ? "long" : "short"}>
              {formatUsd(funding.upcoming, { exact: true, maxDecimals: 4 })}
            </Numeric>
          )
        }
        sub={
          funding.upcoming === undefined ? (
            <NextFunding at={funding.nextFundingTime} epochSeconds={funding.epochSeconds} />
          ) : (
            <>
              {side} {funding.isUpcomingIncome ? "receives" : "pays"} ·{" "}
              <NextFunding at={funding.nextFundingTime} epochSeconds={funding.epochSeconds} />
            </>
          )
        }
        isLoading={funding.isUpcomingLoading}
      />

      {funding.rate !== undefined ? (
        <DetailRow
          label="Funding rate"
          value={<Numeric size="sm">{formatPercent(funding.rate * 100, { decimals: 4 })}</Numeric>}
          sub={funding.epochSeconds ? `per ${Math.round(funding.epochSeconds / 3600)}h epoch` : "per epoch"}
        />
      ) : null}

      <DetailRow
        label="Platform fee"
        tip={{
          title: "Platform fee",
          body: "Computed on this position's size at the price it opened at, at the market's own open-fee rate. An estimate: the contract charges a limit order on its requested price and a market order on the market price at fill.",
        }}
        value={<Numeric size="sm">{formatUsd(fromWei(fees.openFee), { exact: true, maxDecimals: 4 })}</Numeric>}
        sub="on open, est."
      />

      {hasClosed ? (
        <DetailRow
          label="Close fee"
          value={<Numeric size="sm">{formatUsd(fromWei(fees.closeFee), { exact: true, maxDecimals: 4 })}</Numeric>}
          sub="on the closed portion"
        />
      ) : null}
    </DetailSection>
  );
}

/**
 * How long until the estimate above stops being an estimate.
 *
 * A countdown rather than a timestamp because the number it qualifies is
 * changing: "settles in 03:14:22" tells a trader whether the figure is worth
 * acting on, where "settles at 16:00 UTC" makes them do the subtraction.
 */
export function NextFunding({ at, epochSeconds }: { at?: number; epochSeconds?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (at === undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [at]);

  if (at === undefined) {
    return epochSeconds ? <>every {Math.round(epochSeconds / 3600)}h</> : null;
  }

  /* The SDK warns that the solver may report seconds rather than milliseconds. */
  const millis = at < 1e12 ? at * 1000 : at;
  const remaining = Math.max(0, Math.floor((millis - now) / 1000));

  const hours = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <>
      settles in <span className="tnum">{`${hours}:${minutes}:${seconds}`}</span>
    </>
  );
}

interface SheetActionProps {
  actions: ReturnType<typeof usePositionActions>;
  row: PrismQuote;
  /** Closes the sheet once the write is away — the row behind it takes over. */
  onDone: () => void;
  /** False until the market has resolved — a limit close is priced in its precision. */
  canLimitClose: boolean;
  /** Opens the limit-close sheet on top of this one. */
  onLimitClose: () => void;
}

/**
 * The sheet's one call to action, on the same ladder as the blotter's.
 *
 * It resolves to the same rung for the same reasons — chain, delegation, on-chain
 * anchoring, the market's close rules — because both render one shared
 * `resolvePositionIntent`. A sheet that offered a Close the row correctly refused
 * would be the worst kind of disagreement: the sheet is where a trader goes when
 * they are already unsure.
 */
function SheetAction({ actions, row, onDone, canLimitClose, onLimitClose }: SheetActionProps) {
  const intent = resolvePositionIntent(row, actions);

  if (intent.kind === "opening") {
    return <span className="prism-pulse text-sm text-fg-3">opening…</span>;
  }

  if (intent.kind === "closing") {
    return <span className="prism-pulse text-sm text-warn">closing…</span>;
  }

  if (intent.kind === "pending") {
    return <span className="text-sm text-fg-3">pending</span>;
  }

  if (intent.kind === "awaiting-cancel") {
    return (
      <span className="text-sm text-fg-3" title={AWAITING_CANCEL_REASON}>
        {intent.remaining === undefined
          ? "Cancel requested — waiting on the solver"
          : "Cancel requested — force available in "}
        {intent.remaining === undefined ? null : (
          <span className="tnum text-fg-1">{formatCountdown(intent.remaining)}</span>
        )}
      </span>
    );
  }

  if (intent.kind === "switch") {
    return (
      <Button
        size="md"
        variant="secondary"
        title={switchReasonHint(intent.reason, actions.gate.targetName)}
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

  if (intent.kind === "cancel") {
    return intent.force ? (
      <Button
        size="md"
        variant="danger"
        loading={actions.isCancelPending}
        onClick={() => {
          actions.forceCancel();
          onDone();
        }}
      >
        Force cancel
      </Button>
    ) : (
      <Button
        size="md"
        variant="secondary"
        loading={actions.isCancelPending}
        onClick={() => {
          actions.cancel();
          onDone();
        }}
      >
        Cancel order
      </Button>
    );
  }

  if (intent.kind === "settling-cancel-close") {
    return <span className="prism-pulse text-sm text-warn">confirming the cancellation…</span>;
  }

  if (intent.kind === "awaiting-cancel-close") {
    return (
      <span className="text-sm text-fg-3" title={AWAITING_CANCEL_CLOSE_REASON}>
        {intent.remaining === undefined
          ? "Close cancel requested — waiting on the solver"
          : "Close cancel requested — force available in "}
        {intent.remaining === undefined ? null : (
          <span className="tnum text-fg-1">{formatCountdown(intent.remaining)}</span>
        )}
      </span>
    );
  }

  if (intent.kind === "cancel-close") {
    if (intent.force) {
      return (
        <Button
          size="md"
          variant="danger"
          loading={actions.isCancelClosePending}
          onClick={() => {
            actions.forceCancelClose();
            onDone();
          }}
        >
          Force cancel close
        </Button>
      );
    }
    return (
      <Button
        size="md"
        variant="secondary"
        title={
          intent.expired
            ? "This close request has passed its deadline. Releasing it puts the position back to open at once."
            : "Ask the solver to release the resting close. The position stays open throughout."
        }
        loading={actions.isCancelClosePending}
        onClick={() => {
          actions.cancelClose();
          onDone();
        }}
      >
        {intent.expired ? "Release close" : "Cancel close"}
      </Button>
    );
  }

  return (
    <>
      {actions.supportsLimitClose ? (
        <Button
          size="md"
          variant="secondary"
          disabled={!canLimitClose}
          title={canLimitClose ? LIMIT_CLOSE_HINT : "This position's market has not loaded yet."}
          onClick={onLimitClose}
        >
          Limit close
        </Button>
      ) : null}
      <Button
        size="md"
        variant="primary"
        disabled={actions.closeBlocked}
        title={actions.closeBlocked ? CLOSE_BLOCKED_REASON : undefined}
        loading={actions.isClosePending}
        onClick={() => {
          actions.close();
          onDone();
        }}
      >
        Close position
      </Button>
    </>
  );
}

/**
 * Truncate a price to a market's own precision.
 *
 * Truncated rather than rounded so a comparison at this precision cannot flip
 * on a value sitting exactly on the boundary — the same rule the reference app
 * applies before deciding whether two open prices are the same price.
 */
function truncateTo(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.trunc(value * factor) / factor;
}
