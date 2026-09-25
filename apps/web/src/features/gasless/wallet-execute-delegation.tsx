"use client";
import { ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import { describeSelector } from "@/features/session-keys/session-key-selector-labels";
import {
  useAreDelegationsActive,
  useGaslessWalletExecuteSelectors,
  useGrantDelegation,
  type GaslessWalletCall,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { zeroAddress, type Address } from "viem";
import { GaslessFailureNote } from "./gasless-failure-note";

interface Props {
  /** `true` when this card is set to sign with the session key. */
  enabled: boolean;
  /** Sub-account the delegation is granted on; `undefined` until one is picked. */
  subAccount?: Address;
  /** The session key being granted, from the card's write-mode store. */
  sessionKeyAddress?: Address;
  /**
   * The key's own expiry, in milliseconds. The grant uses exactly this value,
   * so the delegation and the key can never outlive one another.
   */
  sessionKeyExpiresAtMs?: number;
  /** The batch to scope the grant to, or `null` while the form cannot describe one. */
  calls: readonly GaslessWalletCall[] | null;
}

/**
 * The wallet-execute card's delegation gate: it checks whether the session key
 * may sign *this* batch, and grants exactly the missing authority.
 *
 * Wallet execution is authorized selector by selector — the GaslessLayer probes
 * a sentinel plus every inner call's own selector — so the onboarding grant on
 * the Session Keys page never covers it. That grant carries the AccountLayer
 * and trade selectors; none of them appear in a wallet batch. Without this
 * control the toggle above could only ever fail with
 * `GASLESS_SIGNER_NOT_DELEGATED`.
 *
 * The grant is scoped to the batch on screen, so changing the call form or the
 * target re-opens the gate. That is the contract's own granularity, not a
 * conservative choice made here.
 */
export function WalletExecuteDelegation({
  enabled,
  subAccount,
  sessionKeyAddress,
  sessionKeyExpiresAtMs,
  calls,
}: Props) {
  const selectors = useGaslessWalletExecuteSelectors({ calls: calls ?? undefined });
  const [error, setError] = useState<Error | null>(null);

  const ready = enabled && Boolean(subAccount) && Boolean(sessionKeyAddress) && selectors.length > 0;
  const delegation = useAreDelegationsActive({
    account: { addr: subAccount ?? zeroAddress, isPartyB: false },
    delegate: sessionKeyAddress ?? zeroAddress,
    selectors,
    query: { enabled: ready },
  });
  const grant = useGrantDelegation();

  /**
   * The delegation expires with the key itself. A longer grant would leave live
   * authority on-chain after the key stops working; a shorter one would break
   * the key before it expires.
   */
  const expiryTimestamp =
    sessionKeyExpiresAtMs === undefined ? undefined : BigInt(Math.floor(sessionKeyExpiresAtMs / 1000));

  if (!ready) return null;
  if (delegation.isLoading) {
    return (
      <ResultNote loading testId="gasless-execute-delegation-loading">
        Checking what the session key may run from the wallet…
      </ResultNote>
    );
  }
  if (delegation.allActive) {
    return (
      <ResultSuccess testId="gasless-execute-delegation-ready">
        The session key holds wallet-execute permission for this batch{" "}
        <span className="font-mono text-xs">({selectors.map(describeSelector).join(", ")})</span>. Executing costs no
        wallet prompt.
      </ResultSuccess>
    );
  }

  return (
    <>
      <ResultWarning testId="gasless-execute-delegation-missing">
        The session key cannot sign this batch yet. Wallet execution is authorized per selector, so it needs{" "}
        <span className="font-mono text-xs">{selectors.map(describeSelector).join(", ")}</span> — the sentinel plus
        every inner call. The Session Keys page grants the trade and account scope instead, which never covers these.
        Grant them here, or turn the key off above and sign with your wallet.
      </ResultWarning>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={expiryTimestamp === undefined || grant.isPending}
        onClick={async () => {
          if (!subAccount || !sessionKeyAddress || expiryTimestamp === undefined) return;
          setError(null);
          try {
            await grant.mutateAsync({
              account: { addr: subAccount, isPartyB: false },
              delegatedSigner: sessionKeyAddress,
              selectors,
              expiryTimestamp,
              gasless: true,
            });
            await delegation.refetch();
          } catch (reason) {
            setError(reason instanceof Error ? reason : new Error(String(reason)));
          }
        }}
        data-testid="button-gasless-execute-grant-delegation"
      >
        {grant.isPending ? (
          <>
            <Spinner className="size-4" /> Granting…
          </>
        ) : (
          "Grant wallet-execute permission"
        )}
      </Button>
      {error ? <GaslessFailureNote error={error} testId="gasless-execute-delegation-error" /> : null}
    </>
  );
}
