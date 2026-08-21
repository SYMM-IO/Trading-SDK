import { cn } from "@/lib/cn";
import type { Address } from "viem";

export interface AccountCellProps {
  /** Resolved display name, or a shortened address when it is not the wallet's own. */
  name: string;
  /** The address behind the name, surfaced on hover — names are not unique. */
  address?: Address | null;
  className?: string;
}

/**
 * The account a row belongs to.
 *
 * Every table on this screen can span a dozen sub-accounts at once, and two of
 * them trading the same market produce rows that are otherwise identical — so
 * with the filter widened, attribution is the difference between a blotter and
 * a pile. The address rides along in the tooltip because sub-account names are
 * user-chosen and may collide.
 */
export function AccountCell({ name, address, className }: AccountCellProps) {
  return (
    <span title={address ?? undefined} className={cn("truncate text-sm text-fg-2", className)}>
      {name}
    </span>
  );
}
