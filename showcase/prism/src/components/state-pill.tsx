import { QuoteLifecycle, QuoteStatus } from "@symmio/trading-core";
import { Pill } from "./pill";

interface StateStyle {
  label: string;
  color: string;
}

/**
 * Lifecycle colors are immune to the palette mode.
 *
 * A trader reading amber must know it means "closing", not "lowcaps". The SDK's
 * `QuoteLifecycle` is richer than the on-chain `QuoteStatus` — it adds the
 * off-chain overlay stages between a hedger accepting an order and the RPC
 * confirming it — so Prism labels the overlay stages honestly rather than
 * pretending they are already on-chain.
 */
const LIFECYCLE_STYLES: Record<QuoteLifecycle, StateStyle> = {
  [QuoteLifecycle.OPTIMISTIC]: { label: "Matching", color: "var(--state-pending)" },
  [QuoteLifecycle.PRICE_FILLED]: { label: "Filled", color: "var(--state-pending)" },
  [QuoteLifecycle.WRITE_ONCHAIN]: { label: "Confirming", color: "var(--state-locked)" },
  [QuoteLifecycle.ONCHAIN]: { label: "Open", color: "var(--state-opened)" },
  [QuoteLifecycle.OPTIMISTIC_CLOSE]: { label: "Closing", color: "var(--state-close-pending)" },
  [QuoteLifecycle.CLOSE_PRICE_FILLED]: { label: "Close filled", color: "var(--state-close-pending)" },
  [QuoteLifecycle.WRITE_ONCHAIN_CLOSE]: { label: "Close confirming", color: "var(--state-close-pending)" },
  [QuoteLifecycle.CLOSED]: { label: "Closed", color: "var(--state-closed)" },
  [QuoteLifecycle.FAILED]: { label: "Failed", color: "var(--state-liquidated)" },
};

const STATUS_STYLES: Record<QuoteStatus, StateStyle> = {
  [QuoteStatus.PENDING]: { label: "Pending", color: "var(--state-pending)" },
  [QuoteStatus.LOCKED]: { label: "Locked", color: "var(--state-locked)" },
  [QuoteStatus.CANCEL_PENDING]: { label: "Cancel pending", color: "var(--state-cancel-pending)" },
  [QuoteStatus.CANCELED]: { label: "Canceled", color: "var(--state-canceled)" },
  [QuoteStatus.OPENED]: { label: "Opened", color: "var(--state-opened)" },
  [QuoteStatus.CLOSE_PENDING]: { label: "Close pending", color: "var(--state-close-pending)" },
  [QuoteStatus.CANCEL_CLOSE_PENDING]: { label: "Cancel close", color: "var(--state-cancel-pending)" },
  [QuoteStatus.CLOSED]: { label: "Closed", color: "var(--state-closed)" },
  [QuoteStatus.LIQUIDATED_PENDING]: { label: "Liquidating", color: "var(--state-liquidated)" },
  [QuoteStatus.LIQUIDATED]: { label: "Liquidated", color: "var(--state-liquidated)" },
  [QuoteStatus.EXPIRED]: { label: "Expired", color: "var(--state-expired)" },
};

export interface StatePillProps {
  /** SDK lifecycle stage — preferred, since it covers the off-chain overlays. */
  lifecycle?: QuoteLifecycle;
  /** On-chain status. Used when the row is anchored and no lifecycle is given. */
  status?: QuoteStatus;
  className?: string;
}

/** Lifecycle chip. Reads the SDK's own state model, never a UI-local guess. */
export function StatePill({ lifecycle, status, className }: StatePillProps) {
  const style = resolveStyle(lifecycle, status);
  if (!style) return null;

  return (
    <Pill
      color={style.color}
      background={`color-mix(in srgb, ${style.color} 13%, transparent)`}
      border={`color-mix(in srgb, ${style.color} 26%, transparent)`}
      className={className}
    >
      {style.label}
    </Pill>
  );
}

function resolveStyle(lifecycle?: QuoteLifecycle, status?: QuoteStatus): StateStyle | undefined {
  /* An anchored on-chain row carries far more detail in its status than the
     generic ONCHAIN lifecycle does, so prefer the status in that one case. */
  if (lifecycle === QuoteLifecycle.ONCHAIN && status !== undefined) return STATUS_STYLES[status];
  if (lifecycle) return LIFECYCLE_STYLES[lifecycle];
  if (status !== undefined) return STATUS_STYLES[status];
  return undefined;
}
