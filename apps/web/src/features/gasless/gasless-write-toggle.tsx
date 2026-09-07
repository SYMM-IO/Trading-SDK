"use client";

import { cn } from "@symmio/ui/lib/utils";
import { useGaslessWriteMode } from "./gasless-write-mode-store";

interface Props {
  /** Contract method name — the shared key into the per-card override store. */
  method: string;
  /**
   * Set when the relayer cannot carry this call as the card can build it. The
   * control renders as a disabled, struck-through bolt explaining why, and the
   * card must pin the same value into `useGaslessWriteOption`'s `blockedReason`
   * so the header and the call agree.
   */
  blockedReason?: string;
}

/**
 * Inline switch that puts one write card on or off the gasless relay, rendered
 * beside the card's `write` badge (via `MethodCard`). It starts on whatever the
 * chain config's `gasless.execution.mode` says and overrides it for this card
 * only, so a call the relayer refuses — or one the user would rather pay gas
 * for — can be sent from the wallet without touching the app-wide config.
 *
 * Renders nothing on a chain with no gasless service configured, and renders a
 * disabled, explained control when the card passes a `blockedReason`. Whether
 * the write is relayable at all is the card's declaration — `MethodCard` only
 * mounts this for a write marked `gaslessRelayable`.
 */
export function GaslessWriteToggle({ method, blockedReason }: Props) {
  const { available, enabled, isOverridden, setEnabled } = useGaslessWriteMode(method);
  if (!available) return null;

  if (blockedReason) {
    return (
      <span
        role="switch"
        aria-checked={false}
        aria-disabled
        aria-label={`Gasless relay unavailable for ${method}`}
        title={`Gasless relay unavailable — ${blockedReason}. This call is sent from the connected wallet.`}
        data-testid={`gasless-toggle-${method}`}
        className="border-border/70 text-muted-foreground/50 inline-flex size-7 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border"
      >
        <BoltIcon struck />
      </span>
    );
  }

  const label = enabled ? "Gasless relay on" : "Gasless relay off";
  const detail = enabled
    ? "relayed with no native gas — click to send it from the wallet"
    : "sent from the connected wallet — click to relay it with no native gas";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${label} for ${method}`}
      title={`${label} — ${detail}${isOverridden ? " (overrides the app config for this card)" : ""}`}
      data-testid={`gasless-toggle-${method}`}
      onClick={() => setEnabled(!enabled)}
      className={cn(
        "focus-visible:ring-ring/40 relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-2",
        enabled
          ? "border-info/40 bg-info/10 text-info"
          : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <BoltIcon struck={!enabled} />
      {isOverridden ? (
        <span className="bg-primary ring-card absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-2" aria-hidden />
      ) : null}
    </button>
  );
}

function BoltIcon({ struck }: { struck: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 2 4.5 13.2h6L11 22l8.5-11.2h-6L13 2Z" fill={struck ? "none" : "currentColor"} />
      {struck ? <path d="M4 20 20 4" /> : null}
    </svg>
  );
}
