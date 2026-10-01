import { QuoteLifecycle } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import type { ComponentProps } from "react";
import { LIFECYCLE_LABEL } from "./quote-state";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/**
 * Tone for each {@link QuoteLifecycle} stage. The off-chain and awaiting-RPC
 * "writing on-chain" stages (open **and** close) lean on neutral/info tones — a
 * resting close being written is not yet "closing"; the confirmed on-chain open
 * anchor is positive; the on-chain `CLOSED` stage is outline, and terminal
 * failure is destructive. Labels live in {@link LIFECYCLE_LABEL} so a badge and a
 * card state never disagree about what a stage is called.
 */
const VARIANT: Record<QuoteLifecycle, BadgeVariant> = {
  [QuoteLifecycle.OPTIMISTIC]: "secondary",
  [QuoteLifecycle.PRICE_FILLED]: "info",
  [QuoteLifecycle.WRITE_ONCHAIN]: "info",
  [QuoteLifecycle.ONCHAIN]: "positive",
  [QuoteLifecycle.OPTIMISTIC_CLOSE]: "secondary",
  [QuoteLifecycle.CLOSE_PRICE_FILLED]: "info",
  [QuoteLifecycle.WRITE_ONCHAIN_CLOSE]: "info",
  [QuoteLifecycle.CLOSED]: "outline",
  [QuoteLifecycle.FAILED]: "destructive",
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
  return <Badge variant={VARIANT[lifecycle] ?? "secondary"}>{LIFECYCLE_LABEL[lifecycle] ?? String(lifecycle)}</Badge>;
}
