"use client";

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/** Default page-size choices offered by {@link Pagination}. */
export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

/** Props for {@link Pagination}: controlled page/page-size state plus range metadata. */
export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  /** Total number of pages (always at least 1). */
  pageCount: number;
  /** Rows shown per page. */
  pageSize: number;
  /** Rows in the current (possibly filtered) result set — drives the range label. */
  total: number;
  /** Unfiltered row count. When greater than `total`, a "filtered from N" hint is shown. */
  totalCount?: number;
  /** Selectable page sizes. Defaults to {@link DEFAULT_PAGE_SIZE_OPTIONS}. */
  pageSizeOptions?: readonly number[];
  /** Called with the next 1-based page. */
  onPageChange: (page: number) => void;
  /** Called with the next page size. */
  onPageSizeChange: (size: number) => void;
  /** Prefix for `data-testid` hooks on the controls. */
  testId?: string;
  className?: string;
}

/**
 * Controlled pagination footer: a rows-per-page selector, a range label
 * (`Showing 1–10 of 42`), and first/previous/next/last navigation. Purely
 * presentational — the parent owns `page`/`pageSize` state and slices the data.
 *
 * @example
 * <Pagination
 *   page={page}
 *   pageCount={pageCount}
 *   pageSize={pageSize}
 *   total={rows.length}
 *   onPageChange={setPage}
 *   onPageSizeChange={setPageSize}
 * />
 */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  totalCount,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  testId,
  className,
}: PaginationProps) {
  const isFirst = page <= 1;
  const isLast = page >= pageCount;
  const start = (page - 1) * pageSize;
  const from = total === 0 ? 0 : start + 1;
  const to = Math.min(start + pageSize, total);
  const isFiltered = totalCount !== undefined && totalCount > total;
  const testFor = (suffix: string) => (testId ? `${testId}-${suffix}` : undefined);

  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="w-[72px]" data-testid={testFor("page-size")} aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-muted-foreground text-xs" data-testid={testFor("range")}>
        Showing{" "}
        <span className="text-foreground font-medium">
          {from}–{to}
        </span>{" "}
        of {total}
        {isFiltered ? ` (filtered from ${totalCount})` : null}
      </span>

      <div className="flex items-center gap-1">
        <span className="text-muted-foreground mr-2 text-xs" data-testid={testFor("page-indicator")}>
          Page <span className="text-foreground font-medium">{page}</span> of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isFirst}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          title="First page"
          data-testid={testFor("page-first")}
        >
          <ChevronFirst />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isFirst}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          title="Previous page"
          data-testid={testFor("page-prev")}
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isLast}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          title="Next page"
          data-testid={testFor("page-next")}
        >
          <ChevronRight />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isLast}
          onClick={() => onPageChange(pageCount)}
          aria-label="Last page"
          title="Last page"
          data-testid={testFor("page-last")}
        >
          <ChevronLast />
        </Button>
      </div>
    </div>
  );
}
