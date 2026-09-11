"use client";

import { KeyIcon } from "@/features/session-keys/session-key-icons";
import { Switch } from "@symmio/ui/components/switch";
import { cn } from "@symmio/ui/lib/utils";
import { shortenAddress } from "@symmio/utils";
import Link from "next/link";
import { useSessionKeyDefault } from "./gasless-write-mode-store";

interface Props {
  /** Called when the delegation link is followed, so the menu can close behind it. */
  onNavigate?: () => void;
}

/**
 * The app-wide session-key switch, in the wallet menu: makes the session key the
 * default signer for every write that can use it — the Contracts and Gasless
 * cards and the Integration flows' account writes — instead of switching it card
 * by card. A card can still opt out with its own key toggle.
 *
 * It lives in the account menu rather than as a header button of its own: the
 * header bar is packed to within a few pixels at every breakpoint, so one more
 * button spills it, and "who signs" belongs with the account anyway.
 *
 * Renders nothing until a key is loaded. On a chain with no gasless relayer —
 * the only path the key signs on — the switch is disabled but keeps its state,
 * which applies again on a chain that has one.
 */
export function SessionKeyDefaultSwitch({ onNavigate }: Props) {
  const { supported, enabled, sessionKeyAddress, setEnabled } = useSessionKeyDefault();
  if (!sessionKeyAddress) return null;

  const active = supported && enabled;

  return (
    <div data-testid="session-key-default" className="border-border/60 flex flex-col gap-2 border-t px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors",
            active ? "bg-primary/10 text-primary ring-primary/30" : "bg-muted text-muted-foreground ring-border",
          )}
          aria-hidden
        >
          <KeyIcon filled={active} className="size-4" />
        </span>
        <label htmlFor="session-key-default-switch" className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
          <span className="text-foreground text-sm font-medium">Sign with session key</span>
          <span className="text-muted-foreground font-mono text-xs">{shortenAddress(sessionKeyAddress)}</span>
        </label>
        <Switch
          id="session-key-default-switch"
          data-testid="session-key-default-switch"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={!supported}
        />
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-muted-foreground text-xs leading-5">
          {supported
            ? "Signs every write that can use it — cards and Integration flows — with no wallet prompt, relayed."
            : "Unavailable on this chain: the key signs only through a gasless relayer."}
        </p>
        <Link
          href="/session-keys"
          onClick={onNavigate}
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium underline underline-offset-4"
        >
          Delegation
        </Link>
      </div>
    </div>
  );
}
