"use client";

import { ResultError, ResultNote, ResultWarning } from "@/components/result";
import { MethodCard } from "@/features/inspector/method-card";
import { MethodGroup } from "@/features/inspector/method-group";
import { SubAccountField } from "@/features/inspector/subaccount-field";
import { useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isAddress, isAddressEqual, zeroAddress, type Address } from "viem";
import { TimelockAccountActions } from "./timelock-account-actions";
import { TimelockApprovalCard } from "./timelock-approval-card";
import { TimelockBatchCard } from "./timelock-batch-card";
import { TimelockManualSetup } from "./timelock-manual-setup";
import { TimelockNamedFunction } from "./timelock-named-function";
import { TimelockPolicyPanel } from "./timelock-policy-panel";
import { TimelockProtectedCall } from "./timelock-protected-call";
import {
  clearReviewedTimelockRecovery,
  notifyTimelockRecoveryChanged,
  readScheduledRecovery,
  readTimelockRecovery,
  subscribeTimelockRecoveryChanged,
} from "./timelock-recovery";
import { useRecoveryNoticeRegistry } from "./timelock-recovery-notices";
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
  useEffect(() => {
    if (subAccount) setInput(subAccount);
  }, [subAccount]);
  const selected = isAddress(input) && !isAddressEqual(input, zeroAddress) ? input : undefined;
  if (!ready) return null;
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
  const context = useTimelockContext(account, undefined, owner, true);
  const storageKey = context.journalScope
    ? `symm:timelock-attempt:${context.journalScope}:${owner.toLowerCase()}`
    : undefined;
  const [recovery, setRecovery] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [reconciliationError, setReconciliationError] = useState<string>();
  const [active, setActive] = useState(false);
  const registry = useRecoveryNoticeRegistry();
  const activeCount = useRef(0);
  const activeKey = useRef<string | undefined>(undefined);
  const [actionMethod, setActionMethod] = useState("addMargin");
  const [protectedName, setProtectedName] = useState("withdraw");
  function onBusyChange(busy: boolean) {
    if (busy) {
      if (activeCount.current++ === 0 && storageKey) {
        activeKey.current = storageKey;
        registry?.begin(storageKey);
      }
    } else if (activeCount.current > 0 && --activeCount.current === 0) {
      if (activeKey.current) registry?.end(activeKey.current);
      activeKey.current = undefined;
    }
    setActive(activeCount.current > 0);
  }
  useEffect(() => {
    if (!storageKey) return;
    const activeKey = storageKey;
    try {
      setRecovery(readTimelockRecovery(storageKey));
      setLoaded(true);
    } catch {
      setStorageError(true);
    }
    function onStorage() {
      try {
        setRecovery(readTimelockRecovery(activeKey));
      } catch {
        setStorageError(true);
      }
    }
    return subscribeTimelockRecoveryChanged(onStorage);
  }, [storageKey]);

  function saveRecovery(value: string | null) {
    if (!storageKey) throw new Error("Account root is not yet resolved.");
    // A storage failure stops issuance/submission rather than losing recovery context.
    try {
      if (value === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, value);
      notifyTimelockRecoveryChanged();
    } catch (error) {
      setStorageError(true);
      throw error;
    }
    setRecovery(value);
  }

  return (
    <>
      {storageError ? (
        <ResultError message="Browser storage is unavailable. Enable it before requesting an approval so recovery survives refresh." />
      ) : null}
      {reconciliationError ? <ResultError message={reconciliationError} /> : null}
      {recovery && !active ? (
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
      <MethodGroup
        label="Policy"
        count={
          1 +
          (loaded && storageKey && !storageError && !context.chainUnsupported && context.rootAccount ? 1 : 0) +
          (loaded && storageKey && !storageError && !context.chainUnsupported && context.rootAccount ? 1 : 0)
        }
        fullWidth
      >
        <TimelockMethodCard
          id="timelock-policy-card"
          name="Timelock policy"
          description="Inspect the root account’s protection and configure the solver policy."
          mutability="nonpayable"
          gaslessRelayable
          gaslessMethod="setupTimelocks"
        >
          <TimelockPolicyPanel context={context} />
        </TimelockMethodCard>
        {loaded && storageKey && !storageError && !context.chainUnsupported && context.rootAccount ? (
          <TimelockMethodCard
            id="timelock-direct-setup-card"
            name="setupTimelocks"
            description="Configure the root policy directly."
            mutability="nonpayable"
            gaslessRelayable
          >
            <TimelockManualSetup
              key={`${context.chainId}:${context.rootAccount}`}
              context={context}
              recovery={recovery}
              storageKey={storageKey}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
            />
          </TimelockMethodCard>
        ) : null}
        {loaded && storageKey && !storageError && !context.chainUnsupported && context.rootAccount ? (
          <TimelockMethodCard
            id="timelock-selector-policy-card"
            name="Selector policy"
            description="Inspect or clear the policy for a specific selector."
            mutability="nonpayable"
            gaslessRelayable
            gaslessMethod="clearTimelocks"
          >
            <TimelockSelectorCard
              context={context}
              disabled={active || Boolean(recovery)}
              recovery={recovery}
              storageKey={storageKey}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
            />
          </TimelockMethodCard>
        ) : null}
      </MethodGroup>
      {loaded && storageKey && !storageError && context.capability && context.policy.data ? (
        <MethodGroup label="Protected operations" count={6} fullWidth initiallyOpen={false}>
          <TimelockMethodCard
            id="timelock-withdrawal-card"
            name="Early withdrawal"
            description="Request solver approval and execute a withdrawal."
            mutability="nonpayable"
            gaslessRelayable
            gaslessMethod="earlyWithdraw"
          >
            <TimelockWithdrawal
              account={account}
              context={context}
              recovery={recovery}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
              storageKey={storageKey}
            />
          </TimelockMethodCard>
          <TimelockMethodCard
            id="timelock-account-actions-card"
            name="Account actions"
            description="Execute an eligible account action with solver approval."
            mutability="nonpayable"
            gaslessRelayable
            gaslessMethod={`timelockAccount:${actionMethod}`}
          >
            <TimelockAccountActions
              account={account}
              context={context}
              recovery={recovery}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
              storageKey={storageKey}
              method={actionMethod}
              onMethodChange={setActionMethod}
            />
          </TimelockMethodCard>
          <TimelockMethodCard
            id="timelock-protected-call-card"
            name="Protected call"
            description="Approve and execute exact calldata."
            mutability="nonpayable"
            gaslessRelayable
            gaslessMethod="timelockProtectedCall"
          >
            <TimelockProtectedCall
              account={account}
              context={context}
              recovery={recovery}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
              storageKey={storageKey}
            />
          </TimelockMethodCard>
          <TimelockMethodCard
            id="timelock-approval-card"
            name="Request approval"
            description="Request a solver approval without submitting a transaction."
            mutability="nonpayable"
            badgeLabel="api"
          >
            <TimelockApprovalCard
              account={account}
              context={context}
              recovery={recovery}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
              storageKey={storageKey}
            />
          </TimelockMethodCard>
          <TimelockMethodCard
            id="timelock-batch-card"
            name="Protected Core batch"
            description="Execute approved Core calls as one batch."
            mutability="nonpayable"
            gaslessRelayable
            gaslessMethod="timelockProtectedBatch"
          >
            <TimelockBatchCard
              context={context}
              recovery={recovery}
              storageKey={storageKey}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
            />
          </TimelockMethodCard>
          <TimelockMethodCard
            id="timelock-function-card"
            name="Protected function"
            description="Choose a protected function and its arguments."
            mutability="nonpayable"
            gaslessRelayable
            gaslessMethod={`timelockNamed:${protectedName}`}
          >
            <TimelockNamedFunction
              account={account}
              owner={owner}
              context={context}
              recovery={recovery}
              storageKey={storageKey}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
              name={protectedName}
              onNameChange={setProtectedName}
            />
          </TimelockMethodCard>
        </MethodGroup>
      ) : (
        <ResultNote>
          Select an account on a deployment advertising timelock approvals to use solver-approved actions.
        </ResultNote>
      )}
      {loaded && storageKey && !storageError && !context.chainUnsupported && context.rootAccount && context.account ? (
        <MethodGroup
          label="Delayed recovery"
          count={1}
          fullWidth
          initiallyOpen={Boolean(recovery)}
          expandOn={Boolean(recovery)}
        >
          <TimelockMethodCard
            id="timelock-delayed-recovery-card"
            name="Schedule and execute"
            description="Schedule, cancel, or execute an exact operation after its cooldown."
            mutability="nonpayable"
            gaslessRelayable
            gaslessMethod="timelockScheduleRecovery"
          >
            <TimelockSchedulePanel
              context={context}
              recovery={recovery}
              saveRecovery={saveRecovery}
              onBusyChange={onBusyChange}
              storageKey={storageKey}
              cardWriteMode
            />
          </TimelockMethodCard>
        </MethodGroup>
      ) : null}
    </>
  );
}

/** Reuse the Contracts method-card design while keeping each action's state and test hooks intact. */
function TimelockMethodCard({
  id,
  name,
  description,
  mutability,
  badgeLabel,
  gaslessRelayable,
  gaslessMethod,
  children,
}: {
  id: string;
  name: string;
  description: string;
  mutability: "view" | "nonpayable";
  badgeLabel?: string;
  gaslessRelayable?: boolean;
  gaslessMethod?: string;
  children: ReactNode;
}) {
  return (
    <MethodCard
      testId={id}
      name={name}
      description={description}
      mutability={mutability}
      badgeLabel={badgeLabel}
      gaslessRelayable={gaslessRelayable}
      gaslessMethod={gaslessMethod}
    >
      <div className="[&>section]:border-0 [&>section]:p-0 [&>section>h3:first-child]:hidden">{children}</div>
    </MethodCard>
  );
}
