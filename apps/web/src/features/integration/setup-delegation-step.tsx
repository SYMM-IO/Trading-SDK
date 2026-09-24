"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import type { useSessionKeyDelegation } from "@/features/session-keys/use-session-key-delegation";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Checkbox } from "@symmio/ui/components/checkbox";
import { Label } from "@symmio/ui/components/label";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatRelativeTimestamp } from "@symmio/utils";
import Link from "next/link";

interface Props {
  delegation: ReturnType<typeof useSessionKeyDelegation>;
  withdraw: boolean;
  onWithdrawChange: (withdraw: boolean) => void;
  /** Whether a session key is loaded at all — the grant has no delegate without one. */
  hasSessionKey: boolean;
}

/**
 * The one wallet prompt of the whole session-key track: grant the local key
 * authority over the chosen sub-account.
 *
 * The grant itself is relayed, so it costs no native gas — but the contract
 * accepts `grantDelegation` only from the account **owner**, which is why the
 * wallet has to sign this one and why nothing the key does afterwards needs a
 * prompt at all.
 *
 * Revocation is not the mirror image and the step does not pretend otherwise:
 * it cannot be relayed, it costs gas, and the key keeps signing until the
 * cooldown ETA passes. That asymmetry is the reason the withdrawal scope is off
 * by default — a key holding `initiateWithdraw` can move collateral to any
 * address, and taking that back is neither instant nor free.
 */
export function SetupDelegationStep({ delegation, withdraw, onWithdrawChange, hasSessionKey }: Props) {
  const scope = !delegation.supportsAccountScope
    ? "trade only — this chain has no gasless account management"
    : withdraw
      ? "trade + account + withdraw"
      : "trade + account";

  return (
    <div className="flex flex-col gap-4">
      <DataList>
        <DataRow label="Status" value={<DelegationStatus delegation={delegation} />} />
        <DataRow label="Scope" value={`${delegation.requiredSelectors.length} selectors — ${scope}`} />
        <DataRow
          label="Grant expires"
          value={
            delegation.expiryTimestamp !== undefined
              ? formatRelativeTimestamp(delegation.expiryTimestamp, {
                  formatFuture: (duration) => `in ${duration}`,
                  formatPast: (duration) => `expired ${duration} ago`,
                })
              : "—"
          }
        />
      </DataList>

      <div className="border-border/70 bg-muted/20 rounded-xl border p-3">
        <Label className="items-start gap-2.5">
          <Checkbox
            checked={withdraw && delegation.supportsAccountScope}
            disabled={!delegation.supportsAccountScope}
            onCheckedChange={(value) => onWithdrawChange(value === true)}
            data-testid="checkbox-setup-delegation-withdraw"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">Also allow withdrawals (off by default)</span>
            <span className="text-muted-foreground text-xs leading-5 font-normal">
              Adds <code className="font-mono">initiateWithdraw</code>, which lets this key send the sub-account’s
              collateral to any address it picks. Leave it off unless the key must run withdrawals unattended — the
              Integration console’s withdraw flow prompts the wallet instead when it is off.
            </span>
          </span>
        </Label>
      </div>

      {!hasSessionKey ? (
        <ResultNote testId="setup-delegation-no-key">
          No session key is loaded, so there is nothing to delegate to. Go back a step and create one.
        </ResultNote>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!hasSessionKey || delegation.isWriting || delegation.isReady}
        onClick={() => void delegation.grant()}
        data-testid="button-setup-delegation-grant"
      >
        {delegation.isWriting ? <Spinner className="size-4" /> : null}
        {delegation.isReady ? "Already granted" : "Grant authority — 1 prompt, no gas"}
      </Button>

      {delegation.isReady ? (
        <ResultSuccess testId="setup-delegation-granted">
          <span className="text-foreground">
            The key holds every selector this scope needs. From here it signs on its own — no wallet prompt, no native
            gas.
          </span>
        </ResultSuccess>
      ) : null}

      {delegation.error ? <ResultError testId="setup-delegation-error" message={delegation.error.message} /> : null}

      <p className="text-muted-foreground text-xs leading-5">
        The full selector list, the revocation controls and the cooldown live on the{" "}
        <Link href="/session-keys" className="text-foreground underline underline-offset-4">
          Session Keys
        </Link>{" "}
        page. Revoking cannot be relayed: it costs native gas and the key keeps its authority until the cooldown ETA
        passes.
      </p>
    </div>
  );
}

/** Ready / revoking / missing-N, read from the contract rather than from the click. */
function DelegationStatus({ delegation }: { delegation: ReturnType<typeof useSessionKeyDelegation> }) {
  if (delegation.isLoading) {
    return (
      <span className="text-muted-foreground flex items-center gap-1.5">
        <Spinner className="size-3.5" /> Reading delegations…
      </span>
    );
  }
  /**
   * A key inside the cooldown is both active and on its way out, and the
   * revocation is the fact that matters — the readiness read alone would render
   * a reassuring "Ready".
   */
  if (delegation.isRevoking) {
    return (
      <Badge variant="warning" data-testid="badge-setup-delegation-revoking">
        Revoking {delegation.revokingSelectorCount} of {delegation.requiredSelectors.length}
      </Badge>
    );
  }
  if (delegation.isReady) {
    return (
      <Badge variant="positive" data-testid="badge-setup-delegation-ready">
        Granted
      </Badge>
    );
  }
  return (
    <Badge variant="warning" data-testid="badge-setup-delegation-missing">
      Missing {delegation.missingSelectors.length} of {delegation.requiredSelectors.length}
    </Badge>
  );
}
