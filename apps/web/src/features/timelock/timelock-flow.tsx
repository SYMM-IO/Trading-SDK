"use client";

import { ResultError, ResultNote, ResultWarning } from "@/components/result";
import { SubAccountField } from "@/features/inspector/subaccount-field";
import { WalletPanel } from "@/features/inspector/wallet-panel";
import { useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { TimelockAccountActions } from "./timelock-account-actions";
import { TimelockApprovalCard } from "./timelock-approval-card";
import { TimelockBatchCard } from "./timelock-batch-card";
import { TimelockNamedFunction } from "./timelock-named-function";
import { TimelockPolicyPanel } from "./timelock-policy-panel";
import { TimelockProtectedCall } from "./timelock-protected-call";
import { clearReviewedTimelockRecovery, readScheduledRecovery, readTimelockRecovery } from "./timelock-recovery";
import { TimelockSchedulePanel } from "./timelock-schedule-panel";
import { TimelockSelectorCard } from "./timelock-selector-card";
import { TimelockWithdrawal } from "./timelock-withdrawal";
import { useTimelockContext } from "./use-timelock-context";

interface Props {
  owner?: Address;
  subAccount?: Address;
  onSelectSubAccount: (account: Address) => void;
  ready: boolean;
}

/** Timelock reference integration, using the same wallet/account controls as other flows. */
export function TimelockFlow({ owner, subAccount, onSelectSubAccount, ready }: Props) {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const [input, setInput] = useState(subAccount ?? "");
  const selected = isAddress(input) ? input : undefined;
  if (!ready) return <WalletPanel />;
  return (
    <div className="flex flex-col gap-6">
      <SubAccountField
        idPrefix="timelock"
        label="Subaccount or virtual account"
        value={input}
        owner={owner}
        onValueChange={(value) => {
          setInput(value);
          if (isAddress(value)) onSelectSubAccount(value);
        }}
      />
      {selected ? (
        <TimelockAccount
          key={`${config.getChainConfigKey(chainId)}:${owner}:${selected}`}
          account={selected}
          owner={owner!}
        />
      ) : null}
    </div>
  );
}

function TimelockAccount({ account, owner }: { account: Address; owner: Address }) {
  const context = useTimelockContext(account);
  const storageKey = context.journalScope
    ? `symm:timelock-attempt:${context.journalScope}:${owner.toLowerCase()}`
    : undefined;
  const [recovery, setRecovery] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [reconciliationError, setReconciliationError] = useState<string>();
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!storageKey) return;
    try {
      setRecovery(readTimelockRecovery(storageKey));
      setLoaded(true);
    } catch {
      setStorageError(true);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === storageKey) setRecovery(event.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  function saveRecovery(value: string | null) {
    if (!storageKey) throw new Error("Account root is not yet resolved.");
    // A storage failure stops issuance/submission rather than losing recovery context.
    try {
      if (value === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, value);
    } catch (error) {
      setStorageError(true);
      throw error;
    }
    setRecovery(value);
  }

  return (
    <>
      <TimelockPolicyPanel context={context} />
      {storageError ? (
        <ResultError message="Browser storage is unavailable. Enable it before requesting an approval so recovery survives refresh." />
      ) : null}
      {reconciliationError ? <ResultError message={reconciliationError} /> : null}
      {recovery ? (
        <ResultWarning>
          {readScheduledRecovery(recovery)?.confirmed
            ? "A confirmed schedule is saved. Continue or cancel it below; do not start a second withdrawal."
            : "An earlier attempt needs reconciliation. Neither another approval nor delayed recovery will start automatically."}
          <details className="my-3">
            <summary>Saved recovery details</summary>
            <pre className="max-h-64 overflow-auto text-xs break-all whitespace-pre-wrap">{recovery}</pre>
          </details>
          <Button
            variant="outline"
            size="sm"
            disabled={active}
            onClick={async () => {
              if (
                window.confirm(
                  "Have you independently reconciled every listed transaction and approval and verified that another operation cannot duplicate them?",
                )
              ) {
                try {
                  setReconciliationError(undefined);
                  if (storageKey && recovery) {
                    await clearReviewedTimelockRecovery(storageKey, recovery);
                    setRecovery(null);
                  }
                } catch (failure) {
                  setReconciliationError(failure instanceof Error ? failure.message : String(failure));
                }
              }
            }}
          >
            Clear after external reconciliation
          </Button>
        </ResultWarning>
      ) : null}
      {loaded && storageKey && !storageError && context.capability && context.policy.data ? (
        <>
          <TimelockWithdrawal
            account={account}
            context={context}
            recovery={recovery}
            saveRecovery={saveRecovery}
            onBusyChange={setActive}
            storageKey={storageKey}
          />
          <TimelockAccountActions
            account={account}
            context={context}
            recovery={recovery}
            saveRecovery={saveRecovery}
            onBusyChange={setActive}
            storageKey={storageKey}
          />
          <TimelockProtectedCall
            account={account}
            context={context}
            recovery={recovery}
            saveRecovery={saveRecovery}
            onBusyChange={setActive}
            storageKey={storageKey}
          />
          <TimelockApprovalCard
            account={account}
            context={context}
            recovery={recovery}
            saveRecovery={saveRecovery}
            onBusyChange={setActive}
            storageKey={storageKey}
          />
          <TimelockBatchCard
            context={context}
            recovery={recovery}
            storageKey={storageKey}
            saveRecovery={saveRecovery}
            onBusyChange={setActive}
          />
          <TimelockNamedFunction
            account={account}
            owner={owner}
            context={context}
            recovery={recovery}
            storageKey={storageKey}
            saveRecovery={saveRecovery}
            onBusyChange={setActive}
          />
          <TimelockSchedulePanel
            context={context}
            recovery={recovery}
            saveRecovery={saveRecovery}
            onBusyChange={setActive}
            storageKey={storageKey}
          />
          <TimelockSelectorCard
            context={context}
            disabled={active || Boolean(recovery)}
            storageKey={storageKey}
            saveRecovery={saveRecovery}
            onBusyChange={setActive}
          />
        </>
      ) : (
        <ResultNote>Select an account on a deployment advertising timelock approvals to use these actions.</ResultNote>
      )}
    </>
  );
}
