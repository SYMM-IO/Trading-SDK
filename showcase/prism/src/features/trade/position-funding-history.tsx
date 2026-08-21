"use client";

import { DetailRow, DetailSection, RowAction } from "@/components/detail-list";
import { Modal } from "@/components/modal";
import { Numeric, Stat } from "@/components/value";
import { formatClock, formatDate, formatPercent, formatRelativeTime, formatUsd, fromWei } from "@/lib/format";
import { useState } from "react";
import type { PrismQuote } from "./positions-provider";
import {
  usePositionFundingHistory,
  type FundingCharge,
  type PositionFundingHistory,
} from "./use-position-funding-history";

export interface PositionFundingHistoryRowProps {
  row: PrismQuote;
}

/**
 * The ledger behind **Net funding**, one row and a sheet of its own.
 *
 * The section above answers *how much* funding has cost this position. This
 * answers *how it got there*, which is a different question a trader asks: $72
 * paid evenly over a week is a carry cost, and the same $72 taken in a handful
 * of charges after the rate flipped is a reason to reconsider the trade.
 *
 * ## Why it opens rather than expands
 *
 * A position charged twice a day for three months has ~180 charges, and a real
 * one on HyperEVM already does. Inlining that list — even collapsed behind a
 * "show all" — puts an unbounded scroll in the middle of a sheet whose whole
 * job is to be scannable, and pushes provenance and the action row past the
 * fold. So the details sheet keeps a *summary* line, and the timeline gets the
 * measure it needs in its own dialog, which scrolls inside itself.
 */
export function PositionFundingHistoryRow({ row }: PositionFundingHistoryRowProps) {
  const history = usePositionFundingHistory(row);
  const [open, setOpen] = useState(false);

  const { state, charges } = history;
  const hasList = state === "known";

  return (
    <>
      <DetailRow
        label="Funding history"
        tip={{
          title: "Funding history",
          body: "Every funding charge the protocol has settled against this position, newest first. Each row is netted the same way the total above it is, so the charges add up to it.",
        }}
        value={
          hasList ? (
            <Numeric size="sm" tone="strong">
              {`${charges.length} charge${charges.length === 1 ? "" : "s"}`}
            </Numeric>
          ) : (
            <Numeric size="sm" tone="muted">
              {SUMMARY_NOTE[state]}
            </Numeric>
          )
        }
        sub={hasList ? summarySub(history) : undefined}
        isLoading={state === "loading"}
        action={
          hasList ? (
            <RowAction onClick={() => setOpen(true)} title="View funding history">
              <ListIcon />
            </RowAction>
          ) : undefined
        }
      />

      {hasList ? <FundingHistoryModal row={row} history={history} open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** What each non-list state says in the summary row, in the sheet's own voice. */
const SUMMARY_NOTE: Record<Exclude<PositionFundingHistory["state"], "known">, string> = {
  "off-chain": "not on-chain yet",
  loading: "…",
  error: "read failed",
  empty: "no charges yet",
  "no-indexer": "no indexer",
};

/** The one line of context the summary row can carry: the span it covers. */
function summarySub(history: PositionFundingHistory): string {
  const oldest = history.charges[history.charges.length - 1];
  const span = oldest ? `since ${formatDate(oldest.timestamp)}` : undefined;
  return history.hasMore ? `most recent — ${span}` : (span ?? "");
}

interface FundingHistoryModalProps {
  row: PrismQuote;
  history: PositionFundingHistory;
  open: boolean;
  onClose: () => void;
}

/**
 * The whole timeline, in a sheet that can afford it.
 *
 * The rate beside each amount is a **magnitude**, not a signed number, for the
 * same reason the upcoming estimate is: the direction is already stated by the
 * amount, which the subgraph reports unambiguously as paid and received, and the
 * sign convention of the published rate is not something this app can prove. A
 * signed rate next to an opposite-signed amount reads as a bug in one of them.
 */
function FundingHistoryModal({ row, history, open, onClose }: FundingHistoryModalProps) {
  const { charges, netListed } = history;
  const net = fromWei(netListed);
  const oldest = charges[charges.length - 1];

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${row.deployment.label} · #${row.quote.quoteId}`}
      title="Funding history"
    >
      <div className="flex flex-wrap items-start gap-6">
        <Stat
          label={history.hasMore ? "Net over listed" : "Net funding"}
          value={
            <Numeric size="lg" signed={net}>
              {formatUsd(net, { exact: true, signed: true, maxDecimals: 4 })}
            </Numeric>
          }
          sub={`${charges.length} charge${charges.length === 1 ? "" : "s"}`}
        />
        <Stat
          label="Since"
          value={
            <Numeric size="lg" tone="strong">
              {oldest ? formatDate(oldest.timestamp) : "—"}
            </Numeric>
          }
          sub={oldest ? formatRelativeTime(oldest.timestamp) : undefined}
        />
      </div>

      {history.hasMore ? (
        <p className="text-2xs text-fg-3">
          This position has more charges than one read returns, so the rows below are its most recent funding, not its
          whole life — they will not add up to the net figure on the details sheet.
        </p>
      ) : null}

      <DetailSection title="Charges" note="newest first">
        {charges.map((charge) => (
          <ChargeRow key={charge.key} charge={charge} />
        ))}
      </DetailSection>
    </Modal>
  );
}

/**
 * One settled charge: when it happened, what it moved, and at what rate.
 *
 * A `DetailRow` rather than a table row so the ledger keeps the app's own
 * label→value rhythm. The timestamp is relative because the useful question is
 * how long ago it landed, with the exact moment on hover for when it is not.
 */
function ChargeRow({ charge }: { charge: FundingCharge }) {
  const net = fromWei(charge.net);

  return (
    <DetailRow
      label={
        <span className="tnum text-fg-2" title={`${formatDate(charge.timestamp)} ${formatClock(charge.timestamp)}`}>
          {formatRelativeTime(charge.timestamp)}
        </span>
      }
      value={
        <Numeric size="sm" signed={net}>
          {formatUsd(net, { exact: true, signed: true, maxDecimals: 4 })}
        </Numeric>
      }
      sub={
        <>
          {charge.rate !== undefined ? formatPercent(charge.rate * 100, { decimals: 4 }) : "rate unreported"}
          {charge.isCatchUp ? " · catch-up" : null}
        </>
      }
    />
  );
}

/** A stack of lines — the ledger this row opens. */
function ListIcon() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" aria-hidden>
      <path d="M2 3h8M2 6h8M2 9h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
