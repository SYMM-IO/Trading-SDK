import { QuoteLifecycle } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import type { ComponentProps } from "react";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

interface LifecycleDisplay {
  label: string;
  variant: BadgeVariant;
}

/**
 * Visual mapping for each {@link QuoteLifecycle} stage. The off-chain and
 * awaiting-RPC "writing on-chain" stages (open **and** close) lean on
 * neutral/info tones — a resting close being written is not yet "closing"; the
 * confirmed on-chain open anchor is positive; the on-chain `CLOSING` /`CLOSED`
 * stages are warning/outline, and terminal failure is destructive.
 */
const DISPLAY: Record<QuoteLifecycle, LifecycleDisplay> = {
  [QuoteLifecycle.OPTIMISTIC]: { label: "Optimistic", variant: "secondary" },
  [QuoteLifecycle.PRICE_FILLED]: { label: "Price filled", variant: "info" },
  [QuoteLifecycle.WRITE_ONCHAIN]: { label: "Writing on-chain", variant: "info" },
  [QuoteLifecycle.ONCHAIN]: { label: "On-chain", variant: "positive" },
  [QuoteLifecycle.OPTIMISTIC_CLOSE]: { label: "Close requested", variant: "secondary" },
  [QuoteLifecycle.CLOSE_PRICE_FILLED]: { label: "Close accepted", variant: "info" },
  [QuoteLifecycle.WRITE_ONCHAIN_CLOSE]: { label: "Writing close on-chain", variant: "info" },
  [QuoteLifecycle.CLOSED]: { label: "Closed", variant: "outline" },
  [QuoteLifecycle.FAILED]: { label: "Failed", variant: "destructive" },
};

interface Props {
  lifecycle: QuoteLifecycle;
}

/**
 * Compact badge for a {@link UnifiedQuote}'s lifecycle stage. Renders the same
 * tone/label regardless of which source the row was reconciled from, so an
 * optimistic off-chain open and an anchored on-chain quote read identically.
 */
export function QuoteLifecycleBadge({ lifecycle }: Props) {
  const display = DISPLAY[lifecycle] ?? { label: String(lifecycle), variant: "secondary" };
  return <Badge variant={display.variant}>{display.label}</Badge>;
}
