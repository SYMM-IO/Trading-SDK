"use client";
import type { UnifiedQuote } from "@symmio/trading-core";
import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";
import { QuoteCardList } from "./quote-card-list";
import { QuotesTable } from "./quotes-table";

interface Props {
  quotes: UnifiedQuote[];
  /** Pre-filter total for the table's "filtered from N" pagination hint. */
  totalCount?: number;
  /** Rows per page in the table variant. */
  defaultPageSize?: number;
  /** Render every table row without a pagination footer. */
  hidePagination?: boolean;
  /** Cap the table's visible rows and pin its header. */
  maxVisibleRows?: number;
  /** Search/filter controls rendered above the table variant. */
  toolbar?: ReactNode;
  testId?: string;
  emptyMessage?: ReactNode;
  /**
   * Render cards at every width. For an instance that already sits inside
   * another horizontally-scrolling table: nesting one sideways scroller in
   * another is never the right answer, whatever the width.
   */
  forceCards?: boolean;
}

/**
 * The quote feed, in whichever shape its container can actually hold.
 *
 * Below `@5xl` (64rem) the feed is a list of cards; at or above it, the table —
 * which is the right shape once its columns genuinely fit. The switch reads
 * `@container/quotes`, never the viewport, because the magic sidebar drags
 * between 360 and 1400px and pops out into its own window: a media query would
 * draw a 1,500px-wide table into a 464px column on a wide monitor, which is
 * exactly the bug this replaces.
 *
 * Both shapes mount and one is hidden, the same way {@link FlowLayout} pairs its
 * rail and gauge. That keeps every width correct with no measurement pass and no
 * first-paint flicker; the per-quote hooks on the hidden side cost nothing extra
 * because they share query keys with the visible one, and mark prices are
 * subscribed per market rather than per quote.
 */
export function QuotesSurface({
  quotes,
  totalCount,
  defaultPageSize,
  hidePagination,
  maxVisibleRows,
  toolbar,
  testId,
  emptyMessage,
  forceCards = false,
}: Props) {
  return (
    <div className="@container/quotes" data-testid={testId ? `${testId}-surface` : undefined}>
      <div className={cn(forceCards ? undefined : "@5xl/quotes:hidden")}>
        <QuoteCardList
          quotes={quotes}
          emptyMessage={emptyMessage}
          showControls={toolbar === undefined}
          testId={testId ? `${testId}-cards` : undefined}
        />
      </div>

      {forceCards ? null : (
        <div className="hidden @5xl/quotes:block">
          <QuotesTable
            quotes={quotes}
            totalCount={totalCount}
            defaultPageSize={defaultPageSize}
            hidePagination={hidePagination}
            maxVisibleRows={maxVisibleRows}
            toolbar={toolbar}
            testId={testId}
            emptyMessage={emptyMessage}
          />
        </div>
      )}
    </div>
  );
}
