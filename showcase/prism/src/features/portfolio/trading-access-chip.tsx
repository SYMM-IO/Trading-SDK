"use client";

import { PILL_SHAPE, Pill, PillDot, PillLabel } from "@/components/pill";
import type { TradingDelegation } from "@/features/wallet/use-trading-delegation";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export interface TradingAccessChipProps {
  delegation: TradingDelegation;
  /** Opens the authorise sheet. Only rendered as a control when a grant is needed. */
  onAuthorise: () => void;
  className?: string;
}

/**
 * Whether the session key may trade for this account — and, when it may not,
 * the one action that fixes it.
 *
 * The chip is the remedy, not only the state. A row that reads "not
 * authorised" and offers nothing sends the user hunting; a row whose chip says
 * `Authorise` names the next rung of the ladder in place, the way the ticket
 * does. The grant itself happens in a sheet, because it is a wallet signature
 * on the account's own chain and the chain gate belongs next to the explanation
 * of what is being signed — not in a seven-row column of "Switch to Base".
 */
export function TradingAccessChip({ delegation, onAuthorise, className }: TradingAccessChipProps) {
  if (!delegation.sessionKey) {
    return <Pill className={cn("prism-pulse", className)}>Key loading</Pill>;
  }
  if (delegation.isLoading) {
    return <Pill className={cn("prism-pulse", className)}>Checking</Pill>;
  }
  if (!delegation.isActive && delegation.probeError) {
    return (
      <span title={delegation.probeError.message} className={className}>
        <Pill dot>Couldn’t check</Pill>
      </span>
    );
  }
  if (!delegation.isActive) {
    return (
      <RemedyChip onClick={onAuthorise} className={className}>
        Authorise
      </RemedyChip>
    );
  }
  if (delegation.isExpiringSoon) {
    return (
      <RemedyChip onClick={onAuthorise} className={className}>
        Renew
      </RemedyChip>
    );
  }
  return (
    <Pill color="var(--long-500)" background="var(--long-bg)" border="var(--long-500)" dot className={className}>
      Ready
    </Pill>
  );
}

/** An amber chip that is a button: the state and its fix in one element. */
function RemedyChip({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        PILL_SHAPE,
        "cursor-pointer border-[var(--warn-500)]/55 bg-warn-bg pe-1.5 text-warn",
        "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "hover:border-[var(--warn-500)] hover:bg-[color-mix(in_srgb,var(--warn-500)_24%,transparent)]",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
        className,
      )}
    >
      <PillDot />
      <PillLabel>{children}</PillLabel>
      <ArrowIcon />
    </button>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="none" aria-hidden>
      <path
        d="M2 6h8M6.5 2.5L10 6l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
