/**
 * What every pool book shares.
 *
 * Each of the five books owns its own column template, read, rows, states and
 * footnote in `./books/`; only what more than one of them needs lands here. That
 * is the rule for this file — anything a single book uses lives in that book —
 * so an edit here is an edit to at least two tables and reads as one.
 */
import { EmptyState, SkeletonRows } from "@/components/table";
import { cn } from "@/lib/cn";
import { fromWei, shortenAddress } from "@/lib/format";
import { PositionType } from "@symmio/trading-core";
import type { ReactNode } from "react";
import { ABSENT } from "./listing-values";

/** Rows per subgraph read. The books are "newest N", not the whole history. */
export const SUBGRAPH_PAGE_SIZE = 50;

export interface TableStatesProps {
  columns: string;
  cells: number;
  isPending: boolean;
  error: Error | null;
  isEmpty: boolean;
  /** What failed to load, in the sentence "Couldn't load …". */
  book: string;
  emptyTitle: string;
  emptyBody: string;
}

/**
 * The ladder every book walks: loading, then failed, then empty.
 *
 * A failed read is not an empty book, and the order here is what keeps those
 * apart — telling a reader a pool has never traded when the subgraph simply did
 * not answer is the worst of the three wrong answers.
 */
export function TableStates({
  columns,
  cells,
  isPending,
  error,
  isEmpty,
  book,
  emptyTitle,
  emptyBody,
}: TableStatesProps) {
  if (isPending) return <SkeletonRows columns={columns} cells={cells} rows={4} />;
  if (error) return <EmptyState title={`Couldn’t load ${book}`} body={error.message} />;
  if (isEmpty) return <EmptyState title={emptyTitle} body={emptyBody} />;
  return null;
}

/** A book's caption. Sits under the rows, where a caveat belongs. */
export function TableFoot({ children }: { children: ReactNode }) {
  return <p className="max-w-[104ch] px-4 py-3 text-2xs text-fg-3">{children}</p>;
}

export interface IdCellProps {
  /** The row's own identifier — a quote id, a conditional-order id. */
  id: ReactNode;
  /** The account behind it. Shortened; the full value rides in the hover title. */
  address?: string | null;
  /** What that account is — `partyA`, `SubAccount`, `wallet`. Named on hover. */
  addressLabel?: string;
}

/**
 * An identifier over the account that owns it.
 *
 * Every book on a pool page is pool-wide rather than account-scoped, so a row's
 * id is only half of what identifies it: two traders' quotes on the same market
 * are otherwise indistinguishable. The address is the other half, and it is
 * somebody else's — which is exactly why it is on the row.
 */
export function IdCell({ id, address, addressLabel }: IdCellProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="tnum truncate text-sm font-semibold text-fg-0">{id}</span>
      <span
        title={address ? `${addressLabel ?? "Account"} ${address}` : undefined}
        className="tnum truncate text-2xs text-fg-3"
      >
        {shortenAddress(address)}
      </span>
    </div>
  );
}

/**
 * Decode a raw `PositionType` ordinal into the SDK's enum.
 *
 * The analytics subgraph and the TP/SL handler both report a side as the bare
 * integer the contract stores rather than the decoded enum the SDK hands back
 * elsewhere — `PoolQuote.positionType` and `ConditionalOrderResponseSchema.
 * position_type` are documented as raw. `PositionType` mirrors that ordering, so
 * the comparison is still against a named member and never against `0` or `1`.
 * An ordinal the contract never emitted resolves to `undefined` rather than
 * silently reading as a long.
 */
export function sideFromOrdinal(value: number | null | undefined): PositionType | undefined {
  if (value === PositionType.LONG) return PositionType.LONG;
  if (value === PositionType.SHORT) return PositionType.SHORT;
  return undefined;
}

/** Long or short, in the direction colors. Direction owns green and red. */
export function SideCell({ side }: { side?: PositionType }) {
  if (side === undefined) return <span className="text-sm text-fg-3">{ABSENT}</span>;

  const isLong = side === PositionType.LONG;
  return (
    <span className={cn("text-sm font-semibold", isLong ? "text-long" : "text-short")}>
      {isLong ? "Long" : "Short"}
    </span>
  );
}

export interface TonedLabel {
  /** What the state is called, in the product's words rather than the wire's. */
  label: string;
  /** Its color, always a design token reference — never a literal hex. */
  color: string;
}

/**
 * Descale a **protocol-scale** 18-decimal figure, preserving "not reported".
 *
 * The subgraph books are the one part of a pool page that is not on the listing
 * service's scale: quantities and prices there are the raw on-chain fixed point
 * the SDK's own quote reads use, so they go through `fromWei` and never through
 * the listing helpers. `fromWei` collapses `null` to `0`, which in a price
 * column reads as "free" rather than "unknown" — this keeps the two apart.
 */
export function protocolNumber(value: bigint | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  return fromWei(value);
}
