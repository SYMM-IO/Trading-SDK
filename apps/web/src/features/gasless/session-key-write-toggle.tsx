"use client";

import { KeyIcon } from "@/features/session-keys/session-key-icons";
import { shortenAddress } from "@symmio/utils";
import { useSessionKeyWriteMode } from "./gasless-write-mode-store";
import { WriteModeSwitch } from "./write-mode-switch";

interface Props {
  /** Contract method name — the shared key into the per-card store. */
  method: string;
  /**
   * The card's gasless block, when it has one. The key signs only through the
   * relay, so a call the relayer cannot carry cannot be key-signed either.
   */
  gaslessBlockedReason?: string;
}

/**
 * Inline switch that signs one write card's calls with the browser-local
 * session key instead of the connected wallet — no wallet prompt, relayed with
 * no native gas. It sits beside the card's gasless bolt, and turning it on puts
 * the card on the relay too, the only path a session key can sign on.
 *
 * The card follows the app-wide switch in the wallet menu until it is flipped
 * here; the corner dot then marks it as an exception to that default.
 *
 * Renders nothing until a key is loaded and the chain has a relayer, and renders
 * a disabled, explained control for the writes a session key can never sign
 * (the deposits among them — see `getSessionKeyBlockedReason`). It does not
 * check the delegation: that depends on the account the card picks, and a
 * missing grant fails with a typed `GASLESS_SIGNER_NOT_DELEGATED` that names
 * the selectors to grant on the Session Keys page.
 */
export function SessionKeyWriteToggle({ method, gaslessBlockedReason }: Props) {
  const { available, blockedReason, enabled, isOverridden, sessionKeyAddress, setEnabled } = useSessionKeyWriteMode(
    method,
    { gaslessBlockedReason },
  );
  if (!available || !sessionKeyAddress) return null;

  if (blockedReason) {
    return (
      <WriteModeSwitch
        testId={`session-key-toggle-${method}`}
        label={`Session key unavailable for ${method}`}
        tooltip={`Session key unavailable — ${blockedReason}. This call is signed by the connected wallet.`}
        checked={false}
        blocked
        tone="primary"
      >
        <KeyIcon struck className="size-3.5" strokeWidth={1.7} />
      </WriteModeSwitch>
    );
  }

  const key = <span className="font-mono">{shortenAddress(sessionKeyAddress)}</span>;
  /** Where the card's state comes from: its own exception, or the wallet menu's default. */
  const source = isOverridden
    ? " This card overrides the wallet menu's default."
    : " Set it for every card from the wallet menu.";

  return (
    <WriteModeSwitch
      testId={`session-key-toggle-${method}`}
      label={`Sign ${method} with the session key`}
      tooltip={
        enabled ? (
          <>
            Signed by session key {key} — no wallet prompt, relayed. Click to sign with the wallet.{source}
          </>
        ) : (
          <>
            Sign with session key {key} — no wallet prompt, relayed. The key needs a delegation for this write on the
            account you pick.{source}
          </>
        )
      }
      checked={enabled}
      onCheckedChange={setEnabled}
      tone="primary"
      marker={isOverridden}
    >
      <KeyIcon filled={enabled} struck={!enabled} className="size-3.5" strokeWidth={1.7} />
    </WriteModeSwitch>
  );
}
