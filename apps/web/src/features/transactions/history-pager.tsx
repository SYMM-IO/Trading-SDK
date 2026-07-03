"use client";

import { Button } from "@symmio/ui/components/button";

interface Props {
  /** Current 1-based page. */
  page: number;
  /** Whether a next page exists (a full look-ahead page came back). */
  hasNextPage: boolean;
  /** Disable both controls while a page is in flight. */
  busy?: boolean;
  onPrev: () => void;
  onNext: () => void;
  testId?: string;
}

/**
 * Prev / next offset pager for the transaction-history cards. The subgraph
 * exposes no total count, so paging is prev/next only and "Next" is enabled while
 * a page comes back full (the card fetches one look-ahead row past the page size
 * to know). Mirrors the quote-history panel's pager.
 */
export function HistoryPager({ page, hasNextPage, busy, onPrev, onNext, testId }: Props) {
  return (
    <div className="flex items-center justify-between text-xs" data-testid={testId}>
      <Button variant="outline" size="xs" disabled={page <= 1 || busy} onClick={onPrev} data-testid={`${testId}-prev`}>
        Prev
      </Button>
      <span className="text-muted-foreground tabular-nums">Page {page}</span>
      <Button
        variant="outline"
        size="xs"
        disabled={!hasNextPage || busy}
        onClick={onNext}
        data-testid={`${testId}-next`}
      >
        Next
      </Button>
    </div>
  );
}
