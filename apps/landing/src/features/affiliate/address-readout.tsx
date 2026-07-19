"use client";

import { CopyButton } from "@symmio/ui/components/copy-button";
import { cn } from "@symmio/ui/lib/utils";

interface AddressReadoutProps {
  /** The address to show, or `undefined` while it is still being derived. */
  address?: string;
  /** Placeholder line shown when there is no address yet. */
  placeholder?: string;
  /** Show the full address (break to multiple lines) rather than a truncation. */
  full?: boolean;
  /** Render the shimmer loading state. */
  loading?: boolean;
  className?: string;
}

/**
 * A monospace address plate with a copy button. Central to the page's signature
 * moment — the deterministic affiliate address that "crystallizes" from the
 * wallet and name — so it has three explicit states: empty placeholder, a
 * shimmer while the on-chain preview resolves, and the settled address.
 */
export function AddressReadout({
  address,
  placeholder = "—",
  full = false,
  loading = false,
  className,
}: AddressReadoutProps) {
  return (
    <div
      className={cn(
        "border-border/70 bg-background/60 flex items-center gap-2 rounded-lg border px-3 py-2.5",
        className,
      )}
    >
      {loading ? (
        <span className="bg-muted h-4 flex-1 animate-pulse rounded" />
      ) : address ? (
        <>
          <code
            className={cn("text-foreground flex-1 font-mono text-sm tracking-tight", full ? "break-all" : "truncate")}
          >
            {address}
          </code>
          <CopyButton value={address} label="Copy address" className="shrink-0" />
        </>
      ) : (
        <span className="text-muted-foreground flex-1 font-mono text-sm">{placeholder}</span>
      )}
    </div>
  );
}
