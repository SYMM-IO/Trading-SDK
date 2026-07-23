"use client";

import { AffiliateState } from "@symmio/trading-core";
import { Button } from "@symmio/ui/components/button";
import { Celebration } from "./celebration";
import { Field } from "./field";
import { WalletIcon } from "./icons";
import { StatusBadge, type StatusTone } from "./status-badge";
import { useStatusLookup } from "./use-status-lookup";

/** Per-state copy for the standalone lookup — worded for a returning affiliate. */
const STATE_VIEW: Record<AffiliateState, { label: string; body: string; tone: StatusTone }> = {
  [AffiliateState.NONE]: {
    label: "No registration",
    body: "No pending or active affiliate exists at this address yet.",
    tone: "muted",
  },
  [AffiliateState.PENDING]: {
    label: "Pending approval",
    body: "Awaiting a protocol admin. You can still cancel it while it's pending.",
    tone: "primary",
  },
  [AffiliateState.ACTIVE]: {
    label: "Active",
    body: "Live and attributing trades — an active affiliate can no longer be cancelled.",
    tone: "positive",
  },
  [AffiliateState.PAUSED]: {
    label: "Paused",
    body: "Paused by an approver — a paused affiliate can't be cancelled here.",
    tone: "muted",
  },
};

/** Label for the adaptive primary action, keyed on what the next step is. */
const PRIMARY_LABEL = {
  "connect-to-cancel": "Connect to cancel",
  switch: "Switch to HyperEVM",
  cancel: "Cancel registration",
} as const;

/** A small inline spinner-plus-text line, reused for the two loading phases. */
function Working({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
      <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      {label}
    </span>
  );
}

/**
 * The "Check status" surface: look up an affiliate by pasting its address, watch
 * its lifecycle state live, and cancel it — but only while it is still `PENDING`,
 * since the contract reverts once it is active or paused. When the looked-up
 * affiliate is `ACTIVE`, fires the celebration (approval is the moment worth
 * celebrating). All state and the adaptive primary action come from
 * {@link useStatusLookup}.
 */
export function AffiliateStatus() {
  const api = useStatusLookup();
  const view = api.state !== undefined ? STATE_VIEW[api.state] : undefined;
  const isActive = api.state === AffiliateState.ACTIVE;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      {isActive ? <Celebration /> : null}

      <header className="flex flex-col items-center gap-4 text-center">
        <span className="border-border/70 bg-muted/30 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase">
          <span className="bg-primary size-1.5 rounded-full" aria-hidden />
          Affiliate status
        </span>
        <h2 className="font-display text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Check a registration
        </h2>
        <p className="text-muted-foreground max-w-xl text-base leading-7 text-pretty">
          Paste the affiliate address you saved at registration to track its approval, and cancel it while it is still
          pending.
        </p>
      </header>

      <div className="border-border/70 bg-card/70 flex flex-col gap-6 rounded-2xl border p-5 shadow-sm backdrop-blur-sm sm:p-7">
        <Field
          id="status-address"
          label="Affiliate address"
          placeholder="0x…"
          value={api.addressInput}
          onChange={(event) => api.setAddressInput(event.target.value)}
          error={api.addressError}
          hint="The affiliate (AccountManager) address you saved at registration."
          spellCheck={false}
          autoComplete="off"
        />

        {/* Live lifecycle state. */}
        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <span className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">Status</span>

          {!api.affiliate ? (
            <p className="text-muted-foreground text-sm leading-6">Paste an affiliate address to check its status.</p>
          ) : api.isChecking ? (
            <Working label="Reading on-chain state…" />
          ) : view ? (
            <div className="flex flex-col gap-3">
              <StatusBadge label={view.label} tone={view.tone} />
              <p className="text-muted-foreground text-sm leading-6">{view.body}</p>
            </div>
          ) : api.stateError ? (
            <p className="text-destructive bg-destructive/10 border-destructive/20 rounded-lg border px-3 py-2 text-xs leading-5">
              {api.stateError}
            </p>
          ) : null}

          {api.primary ? (
            <Button
              type="button"
              size="lg"
              variant={api.primary === "cancel" ? "destructive" : "default"}
              className="w-full"
              disabled={api.isBusy}
              onClick={api.act}
            >
              {api.isBusy ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Working…
                </>
              ) : (
                <>
                  {api.primary === "connect-to-cancel" ? <WalletIcon width={16} height={16} /> : null}
                  {PRIMARY_LABEL[api.primary]}
                </>
              )}
            </Button>
          ) : null}

          {api.primary === "cancel" ? (
            <p className="text-muted-foreground text-xs leading-5">
              Cancelling permanently withdraws the pending registration. You can register again afterwards.
            </p>
          ) : null}

          {api.connectError ? (
            <p className="text-destructive bg-destructive/10 border-destructive/20 rounded-lg border px-3 py-2 text-xs leading-5">
              {api.connectError}
            </p>
          ) : null}

          {api.cancelError ? (
            <p className="text-destructive bg-destructive/10 border-destructive/20 rounded-lg border px-3 py-2 text-xs leading-5">
              {api.cancelError}
            </p>
          ) : null}

          {api.cancelSuccess ? (
            <p className="text-positive bg-positive/10 border-positive/20 rounded-lg border px-3 py-2 text-xs leading-5">
              Registration cancelled — this affiliate is back to unregistered.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
