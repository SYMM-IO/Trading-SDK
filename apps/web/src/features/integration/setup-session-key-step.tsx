"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatRelativeTimestamp } from "@symmio/utils";

/**
 * The browser-local key that will sign on the wallet's behalf.
 *
 * There is usually nothing to do here: the app mints or loads a key as soon as
 * a wallet connects, so the step mostly exists to show *which* key is about to
 * be delegated and when it expires — the delegation is granted for exactly that
 * expiry, so the two can never drift apart. The actions matter when the key is
 * missing (storage blocked or cleared), expired, or being deliberately rotated.
 *
 * Rotating **after** granting leaves the old delegation on-chain pointing at a
 * key that no longer exists, and the new key holds nothing until it is granted
 * again — so the step says so rather than presenting rotation as free.
 */
export function SetupSessionKeyStep() {
  const { owner, sessionKeyAddress, state, metadata, isLoading, error, initialize, rotate } = useSessionKey();
  const isReady = Boolean(sessionKeyAddress && state.isReady);
  const expiresAt = metadata?.expiresAt ?? state.expiresAt ?? undefined;

  return (
    <div className="flex flex-col gap-4">
      <DataList>
        <DataRow
          label="Session key"
          value={sessionKeyAddress ? <AddressTag address={sessionKeyAddress} /> : "None in this browser"}
        />
        <DataRow
          label="Expires"
          value={
            expiresAt !== undefined
              ? formatRelativeTimestamp(BigInt(Math.floor(expiresAt / 1000)), {
                  formatFuture: (duration) => `in ${duration}`,
                  formatPast: (duration) => `expired ${duration} ago`,
                })
              : "—"
          }
        />
        <DataRow label="Private key" value={isReady ? "Encrypted in localStorage" : "Not loaded"} />
      </DataList>

      {isReady ? (
        <ResultNote testId="setup-session-key-ready">
          This key was created for the connected wallet and never leaves this browser. The next step grants it authority
          on-chain, scoped to your sub-account and expiring with the key itself.
        </ResultNote>
      ) : (
        <ResultNote testId="setup-session-key-missing">
          No usable key in this browser — it was never created, was cleared, or has expired. Create one to continue.
        </ResultNote>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!owner || isLoading}
          onClick={() => void initialize()}
          data-testid="button-setup-session-key-initialize"
        >
          {isLoading && !isReady ? <Spinner className="size-4" /> : null}
          {isReady ? "Reload key" : "Create session key"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!owner || isLoading}
          onClick={() => void rotate()}
          data-testid="button-setup-session-key-rotate"
        >
          {isLoading && isReady ? <Spinner className="size-4" /> : null}
          Rotate
        </Button>
      </div>

      {isReady ? (
        <p className="text-muted-foreground text-xs leading-5">
          Rotating replaces the key. Any delegation already granted keeps pointing at the old one, so the new key holds
          no authority until the next step is run again.
        </p>
      ) : null}

      {error ? <ResultError testId="setup-session-key-error" message={error.message} /> : null}
    </div>
  );
}
