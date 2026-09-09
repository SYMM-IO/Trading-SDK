"use client";

import { AddressTag } from "@/components/address-tag";
import { useSessionKeySigning } from "@/features/gasless/gasless-write-mode-store";
import { Switch } from "@symmio/ui/components/switch";
import Link from "next/link";

/**
 * Switch that routes every relayable write's `from` to the browser-local
 * session key instead of the connected wallet.
 *
 * Renders nothing until a key is loaded, so the control only appears once there
 * is an alternative signer to pick. It deliberately does **not** report whether
 * the key is delegated: delegation is per sub-account, and every write card
 * picks its own, so a single verdict here would be wrong as often as right. The
 * link goes to the page that can answer it for a chosen account, and a write
 * sent without the delegation fails with a typed `GASLESS_SIGNER_NOT_DELEGATED`
 * rather than an opaque revert.
 */
export function SessionKeySignerToggle() {
  const { available, enabled, sessionKeyAddress, setEnabled } = useSessionKeySigning();
  if (!available || !sessionKeyAddress) return null;

  return (
    <div
      data-testid="session-key-signer-toggle"
      className="border-border/70 bg-muted/40 flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2"
    >
      <label className="flex min-w-0 items-center gap-2.5">
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Sign relayable writes with the session key"
        />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-foreground text-xs font-medium">Sign with session key</span>
          <span className="text-muted-foreground truncate text-xs">
            <AddressTag address={sessionKeyAddress} />
          </span>
        </span>
      </label>
      <Link
        href="/session-keys"
        className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium underline underline-offset-4"
      >
        Delegation
      </Link>
    </div>
  );
}
