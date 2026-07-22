"use client";

import { LiveDot } from "@/components/live-dot";
import { Button } from "@symmio/ui/components/button";
import { cn } from "@symmio/ui/lib/utils";
import { useWatch } from "react-hook-form";
import { AddressReadout } from "./address-readout";
import { ArrowRightIcon, WalletIcon } from "./icons";
import { truncateAddress } from "./registration-utils";
import type { RegistrationFormApi } from "./use-registration-form";

/** Copy for the adaptive primary button, keyed on what the next step is. */
const ACTION_LABEL = {
  connect: "Connect wallet",
  switch: "Switch to HyperEVM",
  submit: "Submit registration",
} as const;

/** The three-step lifecycle a registration moves through — a real sequence, so it's numbered. */
const LIFECYCLE = [
  { title: "Submit request", body: "Your registration is written on-chain as pending." },
  { title: "Admin review", body: "A protocol admin verifies and approves the affiliate." },
  { title: "Go live", body: "Your affiliate turns active and can start earning fees." },
];

interface SummaryProps {
  api: RegistrationFormApi;
}

/**
 * The sticky summary rail: connected wallet, the deterministic affiliate address
 * preview, the adaptive primary action, any submission error, and the
 * request → review → live lifecycle. This is where the user actually submits.
 */
export function RegistrationSummary({ api }: SummaryProps) {
  const { wallet, action, isBusy, predicted, isPredicting, submitError } = api;

  const name = useWatch({ control: api.control, name: "name" });
  const nameReady = (name ?? "").trim().length > 0 && wallet.isConnected;

  return (
    <div className="min-w-0 lg:sticky lg:top-24">
      <div className="border-border/70 bg-card/70 relative flex min-w-0 flex-col gap-5 overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur-sm sm:p-6">
        {/* Wallet status */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">Wallet</span>
          {wallet.isConnected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <LiveDot tone={wallet.isOnExpectedChain ? "positive" : "primary"} />
              <span className="text-foreground font-mono">{truncateAddress(wallet.address ?? "")}</span>
              <span className={cn(wallet.isOnExpectedChain ? "text-muted-foreground" : "text-primary")}>
                · {wallet.isOnExpectedChain ? "HyperEVM" : "Wrong network"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <WalletIcon width={14} height={14} />
              Not connected
            </span>
          )}
        </div>

        {/* Deterministic address preview — the signature moment. */}
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
            Your affiliate address
          </span>
          <AddressReadout
            address={nameReady ? predicted : undefined}
            loading={nameReady && isPredicting && !predicted}
            placeholder={wallet.isConnected ? "Enter a name to derive…" : "Connect to preview…"}
          />
          <p className="text-muted-foreground text-xs leading-5">
            Derived deterministically from your wallet and name — it&apos;s yours before you even submit.
          </p>
        </div>

        <Button type="button" size="lg" className="w-full" disabled={isBusy} onClick={api.onPrimary}>
          {isBusy ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Working…
            </>
          ) : (
            <>
              {action === "connect" ? <WalletIcon width={16} height={16} /> : null}
              {ACTION_LABEL[action]}
              {action === "submit" ? <ArrowRightIcon width={16} height={16} /> : null}
            </>
          )}
        </Button>

        {submitError ? (
          <p className="text-destructive bg-destructive/10 border-destructive/20 rounded-lg border px-3 py-2 text-xs leading-5">
            {submitError}
          </p>
        ) : null}

        <div className="border-border/60 flex flex-col gap-3 border-t pt-5">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
            What happens next
          </span>
          <ol className="flex flex-col gap-3">
            {LIFECYCLE.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="border-border/70 text-muted-foreground mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]">
                  {index + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-foreground text-sm font-medium">{step.title}</span>
                  <span className="text-muted-foreground text-xs leading-5">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
