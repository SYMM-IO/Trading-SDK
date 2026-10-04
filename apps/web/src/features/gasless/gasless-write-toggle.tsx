"use client";

import { useGaslessWriteMode } from "./gasless-write-mode-store";
import { WriteModeSwitch } from "./write-mode-switch";

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
 * While the card's session key is on, the bolt shows on: the key signs only
 * through the relay. Switching the relay off then takes the key off with it.
 *
 * Renders nothing on a chain with no gasless service configured, and renders a
 * disabled, explained control when the card passes a `blockedReason`. Whether
 * the write is relayable at all is the card's declaration — `MethodCard` only
 * mounts this for a write marked `gaslessRelayable`.
 */
export function GaslessWriteToggle({ method, blockedReason }: Props) {
  const { available, enabled, isOverridden, forcedBySessionKey, setEnabled } = useGaslessWriteMode(method, {
    blockedReason,
  });
  if (!available) return null;

  if (blockedReason) {
    return (
      <WriteModeSwitch
        testId={`gasless-toggle-${method}`}
        label={`Gasless relay unavailable for ${method}`}
        tooltip={`Gasless relay unavailable — ${blockedReason}. This call is sent from the connected wallet.`}
        checked={false}
        blocked
        tone="info"
      >
        <BoltIcon struck />
      </WriteModeSwitch>
    );
  }

  const tooltip = forcedBySessionKey
    ? "Relayed, because the session key signs only through the relay. Click to send from the wallet instead."
    : enabled
      ? "Gasless relay on — relayed with no native gas. Click to send from the wallet."
      : "Gasless relay off — sent from the connected wallet. Click to relay with no native gas.";

  /** While the key holds the relay on, the card's own relay choice is not in effect, so it is not marked. */
  const showOverride = isOverridden && !forcedBySessionKey;

  return (
    <WriteModeSwitch
      testId={`gasless-toggle-${method}`}
      label={`Gasless relay for ${method}`}
      tooltip={showOverride ? `${tooltip} Overrides the app config for this card.` : tooltip}
      checked={enabled}
      onCheckedChange={setEnabled}
      tone="info"
      marker={showOverride}
    >
      <BoltIcon struck={!enabled} />
    </WriteModeSwitch>
  );
}

function BoltIcon({ struck }: { struck: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
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
