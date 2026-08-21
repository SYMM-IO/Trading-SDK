"use client";

import { DetailRow, DetailSection, RowAction } from "@/components/detail-list";
import { MarginModeTag } from "@/components/margin-mode-tag";
import { Skeleton } from "@/components/table";
import { InfoTip } from "@/components/tooltip";
import { Numeric } from "@/components/value";
import { riskStyleFor } from "@/features/portfolio/margin-risk-meter";
import { formatPercent, formatPrice, formatUsd, fromWei } from "@/lib/format";
import type { LockedValues } from "@symmio/trading-core";
import type { PositionRisk } from "./use-position-risk";

export interface PositionMarginSectionProps {
  /** The position's live locked legs — what the contract holds against it now. */
  locked: LockedValues;
  /**
   * Section heading. The grouped sheet passes the group's summed legs, where
   * "this position" is several quotes rather than one.
   * @default "This position's margin"
   */
  title?: string;
  /** Right-aligned note on the rule. @default "locked now" */
  note?: string;
}

/**
 * The margin **this position** locked, leg by leg — or, on the grouped sheet,
 * the same legs summed across every quote in the group.
 *
 * The only figures on the sheet that are genuinely per-position. Everything in
 * Margin & Risk below describes an account, which on a cross-margin book holds
 * many positions and on an unanchored one does not exist yet — so this section
 * is the answer to "how much of that pot is this trade", and it renders in every
 * case, including the ones where the section below cannot.
 *
 * `partyBmm` is deliberately left out: it is the solver's maintenance margin,
 * not partyA's, and the contract's own `totalForPartyA()` is `cva + lf +
 * partyAmm`. Adding the fourth leg would overstate what the trader has at stake.
 */
export function PositionMarginSection({
  locked,
  title = "This position's margin",
  note = "locked now",
}: PositionMarginSectionProps) {
  const total = locked.cva + locked.lf + locked.partyAmm;

  return (
    <DetailSection title={title} note={note}>
      <DetailRow
        label="CVA"
        tip={{
          title: "Credit valuation adjustment",
          body: "The penalty locked against this position, paid to the solver if it is liquidated. Part of the maintenance margin.",
        }}
        value={<Amount value={locked.cva} maxDecimals={4} />}
      />
      <DetailRow
        label="Liquidation fee"
        tip={{
          title: "Liquidation fee",
          body: "Locked to pay whoever liquidates the position. The other half of the maintenance margin.",
        }}
        value={<Amount value={locked.lf} maxDecimals={4} />}
      />
      <DetailRow
        label="Your maintenance margin"
        tip={{
          title: "PartyA maintenance margin",
          body: "The trader's own maintenance margin for this position, over and above CVA and the liquidation fee.",
        }}
        value={<Amount value={locked.partyAmm} maxDecimals={4} />}
      />
      <DetailRow
        label="Locked in total"
        value={
          <Numeric size="sm" tone="strong">
            {formatUsd(fromWei(total), { exact: true, maxDecimals: 4 })}
          </Numeric>
        }
        sub="cva + lf + your mm"
      />
    </DetailSection>
  );
}

export interface PositionRiskSectionProps {
  risk: PositionRisk;
  /** Market price precision for the liquidation price. */
  precision?: number;
  /** Opens the add/remove-margin flow. Absent for a domain with no VA to target. */
  onEditMargin?: () => void;
}

/**
 * The account behind a position and how close it is to being liquidated.
 *
 * ## Why the heading says whose margin it is
 *
 * These figures are properties of an **account**, not of a trade, and which
 * account depends on how the sub-account partitions its margin. On an isolated
 * position the account is a Virtual Account holding this position alone, so the
 * figures read as if they were the position's own. On a cross-margin one they
 * describe the whole book that shares the buffer — the same equity and the same
 * liquidation price appear under every position on that account.
 *
 * Printing the same rows in both cases without saying which is which is how a
 * trader comes to believe a cross-margin position has its own $2,000 of margin.
 * So the section names its domain, and where it covers more than this position
 * it says how many others it covers.
 *
 * ## And why it sometimes refuses to render at all
 *
 * An isolated position that has not anchored on-chain has no Virtual Account
 * yet. Falling back to its `partyA` — which is the obvious thing to do, and what
 * the SDK's group hook does by default — reads the *parent sub-account's*
 * balance: a different liquidation domain, a different number, and no way for a
 * reader to tell. The section says the margin locks on anchoring instead.
 */
export function PositionRiskSection({ risk, precision, onEditMargin }: PositionRiskSectionProps) {
  if (!risk.domain) {
    return (
      <DetailSection title="Margin & risk" note="pending">
        <p className="py-1 text-sm leading-relaxed text-fg-3">
          This position is isolated, so its margin moves into a Virtual Account of its own when it anchors on-chain.
          Until then there is no account to measure — the legs it has locked are above.
        </p>
      </DetailSection>
    );
  }

  const { metrics } = risk;
  const isLoading = risk.isLoading && !metrics;

  const buffer =
    metrics?.liquidationBufferPercent === undefined ? undefined : fromWei(metrics.liquidationBufferPercent);
  const style = riskStyleFor(metrics?.isLiquidatable ?? false, buffer);
  const filled = buffer === undefined ? 0 : Math.min(100, Math.max(0, buffer));

  const isolated = risk.domain === "virtual-account";
  const shared = risk.positionCount - 1;

  return (
    <DetailSection
      title="Margin & risk"
      note={
        isolated
          ? "Virtual Account"
          : shared > 0
            ? `Whole sub-account · ${shared} other position${shared === 1 ? "" : "s"}`
            : "Whole sub-account"
      }
    >
      {!isolated ? (
        <p className="pb-1 text-2xs leading-relaxed text-fg-3">
          Cross-margin: this position has no margin of its own. Every figure below is the account&rsquo;s, shared with
          everything else open on it.
        </p>
      ) : null}

      <DetailRow
        label="Initial margin"
        tip={{
          title: "Initial margin",
          body: "Every leg partyA has locked across this account — CVA, liquidation fee and partyA maintenance margin. It shrinks as positions close, because the contract releases margin with them.",
        }}
        value={<Amount value={metrics?.initialMargin} />}
        isLoading={isLoading}
      />

      <DetailRow
        label="Maintenance margin"
        tip={{
          title: "Maintenance margin",
          body: "Locked CVA plus locked liquidation fee — the level equity is liquidated at. When equity falls to this number the account is liquidatable.",
        }}
        value={<Amount value={metrics?.maintenanceMargin} />}
        isLoading={isLoading}
      />

      <DetailRow
        label="Total margin"
        tip={{
          title: "Total margin",
          body: isolated
            ? "The collateral allocated to this position's Virtual Account. Top it up to move the liquidation price away."
            : "The collateral allocated to this sub-account. Every position on it draws from this one pot, so it is topped up from Portfolio rather than from a position.",
        }}
        value={<Amount value={metrics?.totalMargin} />}
        sub={<MarginModeTag crossMargin={!isolated} />}
        action={
          /* Hidden rather than disabled on a cross-margin account: `addMargin`
             targets a Virtual Account, and there is none to target. The account
             equivalent is allocate/deallocate, which lives in Portfolio. */
          onEditMargin ? (
            <RowAction onClick={onEditMargin} title="Add or remove this position's margin">
              <PenIcon />
            </RowAction>
          ) : undefined
        }
        isLoading={isLoading}
      />

      {/* The only boxed thing in the sheet. Equity and the buffer are the two
          numbers a trader checks under pressure, and everything above is an
          input to them — so they get the one surface change that says "read
          this first" without adding a second heading. */}
      <div className="mt-2 rounded-lg border border-line-subtle bg-bg-0/60 p-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-center gap-1 text-sm text-fg-2">
            Equity
            <span className="text-fg-3">
              <InfoTip title="Equity">
                Total margin plus unrealized P&amp;L — what the account is worth at the current mark.
              </InfoTip>
            </span>
          </span>
          {isLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <Numeric size="xl" tone="strong">
              {metrics ? formatUsd(fromWei(metrics.equity), { exact: true }) : "—"}
            </Numeric>
          )}
        </div>

        {/* uPnL is folded from live marks, and a market that has not ticked
            contributes nothing — so equity quietly equals total margin and the
            account reads as safe. That is the one failure here worth a warning. */}
        {!risk.isUpnlComplete && risk.positionCount > 0 ? (
          <p className="mt-1 text-2xs text-warn">
            {/* The interpolation swallows the space that would otherwise sit
                before the dash, so the separator is part of the expression. */}
            {`Waiting on a mark for ${risk.isMultiMarket ? "some of these markets" : "this market"} — equity and the buffer exclude their unrealized P&L.`}
          </p>
        ) : null}

        <div className="mt-3 flex items-baseline justify-between gap-3 text-2xs">
          <span className="flex items-center gap-1 text-fg-2">
            <span className="flex items-baseline gap-1">
              Liq. price
              <span className="tnum font-semibold text-fg-1">
                {risk.liquidationPrice > 0n ? formatPrice(fromWei(risk.liquidationPrice), precision) : "—"}
              </span>
            </span>
            {/* `0n` from the SDK covers "no positions read yet" as well as "no
                price liquidates this account", and nothing distinguishes them —
                so the dash stays a dash and the buffer is named as the reading
                to trust instead of guessing which case this is. */}
            {risk.liquidationPrice === 0n ? (
              <span className="text-fg-3">
                <InfoTip title="No liquidation price" width={260}>
                  The SDK could not derive one for this account — read the buffer beside it instead, which comes from
                  the protocol&rsquo;s own liquidation test.
                </InfoTip>
              </span>
            ) : null}
          </span>
          <span className="font-semibold tracking-[0.08em] uppercase" style={{ color: style.color }}>
            {buffer === undefined ? style.label : `${formatPercent(filled, { decimals: 0 })} buffer`}
          </span>
        </div>

        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-bg-0">
          <span
            aria-hidden
            className="block h-full rounded-full"
            style={{
              width: `${isLoading ? 0 : filled}%`,
              background: `linear-gradient(90deg, ${style.fill}, ${style.color})`,
              transition: "width var(--dur-base) var(--ease-out)",
            }}
          />
        </span>

        <div className="mt-1.5 flex items-baseline justify-end gap-1.5 text-2xs">
          <span className="flex items-center gap-1 text-fg-2">
            Left to liquidation
            <span className="text-fg-3">
              <InfoTip title="Left to liquidation" width={260}>
                Equity minus maintenance margin — how much the account can lose before it is liquidatable. A negative
                figure means it already is.
              </InfoTip>
            </span>
          </span>
          <span className="tnum font-semibold" style={{ color: style.color }}>
            {metrics ? formatUsd(fromWei(metrics.remainingToLiquidation), { exact: true }) : "—"}
          </span>
        </div>
      </div>

      {/* The SDK derives the liquidation price from the first open position's
          side, so an account holding both directions gets one price that only
          describes one of them. A cross-margin book is where that happens. */}
      {!isolated && risk.isMultiMarket ? (
        <p className="mt-2 text-2xs leading-relaxed text-fg-3">
          This account holds positions in several markets. The liquidation price is derived from the first one&rsquo;s
          direction, so read the buffer rather than the price.
        </p>
      ) : null}
    </DetailSection>
  );
}

/** A wei amount as exact USD — margin figures are never abbreviated. */
function Amount({ value, maxDecimals }: { value?: bigint; maxDecimals?: number }) {
  return (
    <Numeric size="sm" tone="strong">
      {value === undefined ? "—" : formatUsd(fromWei(value), { exact: true, maxDecimals })}
    </Numeric>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" aria-hidden>
      <path d="M8.2 1.6l2.2 2.2-6 6-2.9.7.7-2.9 6-6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}
