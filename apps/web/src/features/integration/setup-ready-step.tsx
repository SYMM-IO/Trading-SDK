"use client";

import { ResultNote, ResultSuccess } from "@/components/result";
import { useSessionKeyDefault } from "@/features/gasless/gasless-write-mode-store";
import { useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Switch } from "@symmio/ui/components/switch";
import Link from "next/link";
import type { SetupTrack } from "./setup-track";

interface Props {
  track: SetupTrack;
  /** Every prerequisite of the chosen track is met. */
  complete: boolean;
  /** Jump into the trading flows on this console. */
  onStartTrading: () => void;
}

/**
 * The terminus: what the chosen track has unlocked, and the two app-level
 * switches that decide whether the flows actually use it.
 *
 * Those switches are the reason this step exists at all. Granting an allowance
 * and a delegation makes a relayed, key-signed write *possible*; it does not
 * make it *happen*. The relay is chosen per chain by
 * `gasless.execution.mode`, and the key is chosen by the app-wide default — so
 * a fully provisioned account whose switches are off still prompts the wallet
 * for every action, which looks exactly like the setup having failed.
 */
export function SetupReadyStep({ track, complete, onStartTrading }: Props) {
  const chainId = useSymmioChainId();
  const gasless = useSymmioConfig().getChainConfig(chainId).gasless;
  const relayMode = gasless?.execution?.mode === "gasless";
  const sessionKeyDefault = useSessionKeyDefault();

  const wantsRelay = track !== "wallet";
  const wantsKey = track === "session-key";

  return (
    <div className="flex flex-col gap-4">
      {complete ? (
        <ResultSuccess testId="setup-ready-complete">
          <span className="text-foreground">
            {track === "wallet"
              ? "Funded and ready. Every flow on this console will prompt your wallet and use native gas."
              : track === "gasless"
                ? "Funded and provisioned. Relayed writes need no native gas — your wallet still signs each one."
                : "Funded, provisioned and delegated. The session key signs on its own: no prompts, no native gas."}
          </span>
        </ResultSuccess>
      ) : (
        <ResultNote testId="setup-ready-incomplete">
          Some prerequisites are still open. Use the rail to go back to any step that is not ticked.
        </ResultNote>
      )}

      {wantsRelay ? (
        <div className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
          <p className="text-foreground text-sm font-medium">Make the app use it</p>

          <div className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-1">
              <span className="text-foreground text-sm">Relay writes on this chain</span>
              <span className="text-muted-foreground text-xs leading-5">
                Set by the chain config’s <code className="font-mono">gasless.execution.mode</code>, not by this page.
                While it is off, the flows fall back to ordinary wallet transactions even though the allowance is
                granted.
              </span>
            </span>
            <span
              className={relayMode ? "text-positive text-xs font-medium" : "text-warning text-xs font-medium"}
              data-testid="setup-ready-relay-mode"
            >
              {relayMode ? "On" : "Off"}
            </span>
          </div>

          {!relayMode ? (
            <p className="text-muted-foreground text-xs leading-5">
              Turn it on for this chain on the{" "}
              <Link href="/config" className="text-foreground underline underline-offset-4">
                Config
              </Link>{" "}
              page.
            </p>
          ) : null}

          {wantsKey ? (
            <label className="border-border/60 bg-background/40 flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
              <span className="flex flex-col gap-1">
                <span className="text-foreground text-sm">Sign with the session key by default</span>
                <span className="text-muted-foreground text-xs leading-5">
                  The same switch as the one in the wallet menu. Off, the delegation sits unused and every write
                  prompts. Writes a key may never sign — deposits above all — stay on the wallet regardless.
                </span>
              </span>
              <Switch
                checked={sessionKeyDefault.enabled}
                disabled={!sessionKeyDefault.supported || sessionKeyDefault.sessionKeyAddress === undefined}
                onCheckedChange={sessionKeyDefault.setEnabled}
                data-testid="toggle-setup-ready-session-key-default"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={onStartTrading}
        data-testid="button-setup-start-trading"
      >
        Go to the trading flows
      </Button>
    </div>
  );
}
