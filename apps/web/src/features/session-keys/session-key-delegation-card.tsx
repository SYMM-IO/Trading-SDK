"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { ResultError } from "@/components/result";
import { useUserSubAccounts, useWalletAccount } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symmio/ui/components/card";
import { Checkbox } from "@symmio/ui/components/checkbox";
import { Label } from "@symmio/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatRelativeTimestamp, shortenAddress } from "@symmio/utils";
import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { AlertTriangleIcon, ClockIcon, GasFreeIcon, ShieldCheckIcon } from "./session-key-icons";
import { describeSelector, getSelectorScope } from "./session-key-selector-labels";
import { useSessionKey } from "./use-session-key";
import { useSessionKeyDelegation } from "./use-session-key-delegation";

/**
 * Onboarding and status for the local session key's Instant Layer authority:
 * grant it, see exactly what it holds, and revoke it.
 *
 * The card is deliberately explicit about the asymmetry between the two
 * directions. Granting is relayed, so it costs no native gas and — because the
 * contract only accepts `grantDelegation` from the account owner — it is the
 * one and only wallet prompt the key ever needs. Revoking cannot be relayed: it
 * is a wallet transaction that costs native gas, and the key keeps working
 * until the cooldown ETA passes.
 */
/**
 * Name the authority groups the grant actually covers. The account and withdraw
 * scopes exist only on perps-core 0.8.6, so on an older chain the grant really
 * is trade-only and must not claim otherwise.
 */
function describeScope(supportsAccountScope: boolean, withdraw: boolean): string {
  if (!supportsAccountScope) return "trade only (this chain has no gasless account management)";
  return withdraw ? "trade + account + withdraw" : "trade + account";
}

export function SessionKeyDelegationCard() {
  const { address: owner, isConnected, isOnExpectedChain } = useWalletAccount();
  const { sessionKeyAddress, metadata, state } = useSessionKey();
  const subAccounts = useUserSubAccounts({ user: owner });
  const [subAccount, setSubAccount] = useState<Address | undefined>(undefined);
  const [withdraw, setWithdraw] = useState(false);
  const [revokeStartedAtMs, setRevokeStartedAtMs] = useState<number | null>(null);

  /** Default to the first sub-account once the list arrives, without pinning a stale choice. */
  useEffect(() => {
    const first = subAccounts.data?.[0]?.accountAddress;
    if (!subAccount && first) setSubAccount(first);
  }, [subAccounts.data, subAccount]);

  /**
   * The delegation must expire exactly when the session key does. The key's own
   * `expiresAt` is the source of truth, so a rotated or imported key moves both
   * together instead of leaving a longer-lived grant behind on-chain.
   */
  const sessionKeyExpiresAtMs = metadata?.expiresAt ?? state.expiresAt ?? undefined;

  const delegation = useSessionKeyDelegation({
    subAccount,
    sessionKey: sessionKeyAddress ?? undefined,
    sessionKeyExpiresAtMs,
    withdraw,
  });

  const canWrite = Boolean(
    isConnected && isOnExpectedChain && subAccount && sessionKeyAddress && delegation.expiryTimestamp !== undefined,
  );
  const cooldownEtaSeconds =
    revokeStartedAtMs !== null && delegation.cooldownSeconds !== undefined
      ? BigInt(Math.floor(revokeStartedAtMs / 1000)) + delegation.cooldownSeconds
      : undefined;
  const isCoolingDown = cooldownEtaSeconds !== undefined && cooldownEtaSeconds > BigInt(Math.floor(Date.now() / 1000));

  return (
    <Card data-testid="card-session-key-delegation">
      <CardHeader>
        <CardTitle>Gasless session-key authority</CardTitle>
        <CardDescription>
          Delegate trading and account-management authority to the local session key. Granting is relayed, so it costs
          no native gas — and because only the account owner may grant, this is the one wallet prompt the key ever
          needs. Every action it signs afterwards is promptless.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-key-delegation-subaccount">Sub-account</Label>
            <Select
              value={subAccount ?? ""}
              onValueChange={(value) => setSubAccount(value as Address)}
              disabled={!owner || (subAccounts.data?.length ?? 0) === 0}
            >
              <SelectTrigger id="session-key-delegation-subaccount" data-testid="select-delegation-subaccount">
                <SelectValue placeholder={owner ? "Select a sub-account" : "Connect wallet"} />
              </SelectTrigger>
              <SelectContent>
                {subAccounts.data?.map((sub) => (
                  <SelectItem key={sub.accountAddress} value={sub.accountAddress} description={sub.accountAddress}>
                    {sub.name || shortenAddress(sub.accountAddress)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataList>
            <DataRow
              label="session key"
              value={sessionKeyAddress ? <AddressTag address={sessionKeyAddress} /> : "Not initialized"}
            />
            <DataRow label="status" value={<ReadinessBadge delegation={delegation} />} />
            <DataRow
              label="delegation expires"
              value={
                delegation.activeExpiryTimestamp !== undefined
                  ? formatRelativeTimestamp(delegation.activeExpiryTimestamp, {
                      formatFuture: (duration) => `in ${duration}`,
                      formatPast: (duration) => `expired ${duration} ago`,
                    })
                  : "No live grant"
              }
            />
            <DataRow
              label="scope"
              value={`${delegation.requiredSelectors.length} selectors — ${describeScope(delegation.supportsAccountScope, withdraw)}`}
            />
          </DataList>

          {delegation.missingSelectors.length > 0 ? <MissingSelectors selectors={delegation.missingSelectors} /> : null}

          <div className="border-border/70 bg-muted/20 space-y-2 rounded-xl border p-3">
            <Label className="items-start gap-2.5">
              <Checkbox
                checked={withdraw && delegation.supportsAccountScope}
                disabled={!delegation.supportsAccountScope}
                onCheckedChange={(value) => setWithdraw(value === true)}
                data-testid="checkbox-delegation-withdraw"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">Also allow withdrawals (off by default)</span>
                <span className="text-muted-foreground text-xs font-normal">
                  Adds <code className="font-mono">initiateWithdraw</code>, which lets this key move the sub-account’s
                  collateral to any address it chooses. Only tick this for a key that must run withdrawals unattended.
                </span>
              </span>
            </Label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!canWrite || delegation.isWriting || delegation.isReady}
              onClick={() => void delegation.grant()}
              data-testid="button-grant-session-key-delegation"
            >
              {delegation.isWriting ? (
                <>
                  <Spinner className="size-4" /> Granting...
                </>
              ) : (
                <>
                  <GasFreeIcon className="size-4" /> Grant authority — 1 prompt, no gas
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canWrite || delegation.isWriting || delegation.activeSelectors.length === 0}
              onClick={() => {
                setRevokeStartedAtMs(Date.now());
                void delegation.initiateRevoke();
              }}
              data-testid="button-initiate-revoke-delegation"
            >
              Start revoke (costs gas)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!canWrite || delegation.isWriting || isCoolingDown}
              onClick={() => void delegation.finalizeRevoke()}
              data-testid="button-finalize-revoke-delegation"
            >
              Finalize revoke (costs gas)
            </Button>
          </div>

          <RevocationNotice
            cooldownSeconds={delegation.cooldownSeconds}
            etaSeconds={cooldownEtaSeconds}
            isCoolingDown={isCoolingDown}
          />

          {delegation.error ? (
            <ResultError testId="result-session-key-delegation-error" message={delegation.error.message} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Ready / missing-N summary for the current scope. */
function ReadinessBadge({ delegation }: { delegation: ReturnType<typeof useSessionKeyDelegation> }) {
  if (delegation.isLoading)
    return (
      <span className="text-muted-foreground flex items-center gap-1.5">
        <Spinner className="size-3.5" /> Reading delegations...
      </span>
    );
  if (delegation.isReady)
    return (
      <Badge variant="positive" data-testid="badge-delegation-ready">
        <ShieldCheckIcon className="size-3" /> Ready
      </Badge>
    );
  return (
    <Badge variant="warning" data-testid="badge-delegation-missing">
      <AlertTriangleIcon className="size-3" /> Missing {delegation.missingSelectors.length} of{" "}
      {delegation.requiredSelectors.length}
    </Badge>
  );
}

/** The exact selectors the key still lacks, grouped by the authority they carry. */
function MissingSelectors({ selectors }: { selectors: readonly Hex[] }) {
  return (
    <div
      className="border-warning/30 bg-warning/10 space-y-2 rounded-xl border px-3 py-2.5"
      data-testid="result-delegation-missing-selectors"
    >
      <p className="text-sm font-medium">Not delegated yet</p>
      <ul className="flex flex-wrap gap-1.5">
        {selectors.map((selector) => (
          <li key={selector}>
            <Badge variant="outline" className="font-mono" title={selector}>
              {describeSelector(selector)}
              <span className="text-muted-foreground">· {getSelectorScope(selector)}</span>
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** States the cost and the timing of revocation without ever implying it can be relayed. */
function RevocationNotice({
  cooldownSeconds,
  etaSeconds,
  isCoolingDown,
}: {
  cooldownSeconds?: bigint;
  etaSeconds?: bigint;
  isCoolingDown: boolean;
}) {
  return (
    <div className="text-muted-foreground flex items-start gap-2 text-xs" data-testid="note-revocation-cost">
      <ClockIcon className="mt-0.5 size-4 shrink-0" />
      <p>
        Revocation cannot be relayed — both steps are wallet transactions that cost native gas. Starting a revoke does
        not take authority away immediately: the key keeps signing for the full cooldown
        {cooldownSeconds !== undefined ? ` (${formatCooldown(cooldownSeconds)})` : ""}, and only stops when the ETA
        passes. Finalizing afterwards clears the stored grant and may be called by anyone.
        {isCoolingDown && etaSeconds !== undefined
          ? ` Still live — finalize ${formatRelativeTimestamp(etaSeconds)}.`
          : ""}
      </p>
    </div>
  );
}

/** Render a cooldown duration in seconds as a compact `10m` / `2h` style string. */
function formatCooldown(seconds: bigint): string {
  const total = Number(seconds);
  if (total < 60) return `${total}s`;
  if (total < 3_600) return `${Math.round(total / 60)}m`;
  return `${Math.round(total / 360) / 10}h`;
}
