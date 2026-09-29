"use client";

import { ResultWarning } from "@/components/result";
import type { MarketLockReason } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { formatLockReasons } from "./format-listing-value";

interface Props {
  /**
   * Why the pool is locked — the detail read's `lockReasons`. Omit on a catalog
   * row, which carries only the flag; the copy then points at the pool's detail.
   */
  reasons?: readonly MarketLockReason[];
  testId?: string;
}

/**
 * "Locked" badge for a pool the inventory service has locked against new
 * deposits. Render it only when `isLocked` is true. The lock is orthogonal to
 * the lifecycle status — a live pool can be locked — so it sits next to the
 * status badge rather than replacing it. Hovering says what the lock means:
 * deposits are paused; trading, withdrawals and claims are not.
 */
export function PoolLockBadge({ reasons, testId }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="warning" tabIndex={0} data-testid={testId}>
          Locked
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="flex max-w-64 flex-col gap-1">
        <p>Deposits paused. Trading, withdrawals and claims still work.</p>
        {reasons === undefined ? (
          <p className="text-muted-foreground">Open the pool for the reasons.</p>
        ) : reasons.length > 0 ? (
          <p className="text-muted-foreground">{formatLockReasons(reasons)}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Warning panel for a locked pool, for the cards that would otherwise offer a
 * deposit. Names the reasons when the caller has the detail read.
 */
export function PoolLockNotice({ reasons, testId }: Props) {
  const why = reasons !== undefined && reasons.length > 0 ? ` — ${formatLockReasons(reasons)}` : "";
  return (
    <ResultWarning testId={testId}>
      Deposits into this pool are paused{why}. Trading, withdrawals and claims are unaffected.
    </ResultWarning>
  );
}
