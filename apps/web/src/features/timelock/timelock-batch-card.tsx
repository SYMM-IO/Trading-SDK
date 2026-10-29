"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { AmountField } from "@/features/integration/amount-field";
import { parseAmount } from "@/features/integration/parse-amount";
import type { ValidatedTimelockApproval } from "@symmio/trading-core";
import { useExecuteAccountCalls, useTimelockApprovalProvider } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { useEffect, useRef, useState } from "react";
import { recoveryTransactionHash, withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

interface Props {
  context: TimelockContext;
  recovery: string | null;
  storageKey: string;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}

/** Exercise the public atomic Core batch action with two separately authorized allocations. */
export function TimelockBatchCard({ context, recovery, storageKey, saveRecovery, onBusyChange }: Props) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<string>();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const action = useExecuteAccountCalls();
  const provider = useTimelockApprovalProvider({ chainId: context.chainId, solverId: context.solverId });
  const amount1 = parseAmount(first, 18);
  const amount2 = parseAmount(second, 18);
  async function submit() {
    const capability = context.capability;
    const account = context.policy.data?.rootAccount;
    if (!capability || !account || amount1 === undefined || amount2 === undefined || !context.ready || recovery || busy)
      return;
    const authorizedCapability: NonNullable<typeof capability> = capability;
    setError(undefined);
    setHash(undefined);
    setBusy(true);
    onBusyChange(true);
    const issued: ValidatedTimelockApproval[] = [];
    let saved: string | undefined;
    try {
      await withTimelockAttemptLock(storageKey, async () => {
        saveRecovery("A protected batch is being prepared. Reconcile its outcome before trying again.");
        const block = await context.config.getClient({ chainId: context.chainId }).getBlock();
        if (!alive.current) throw new Error("Account changed before the approval request.");
        function authorization() {
          return {
            capability: authorizedCapability,
            provider,
            deadline: block.timestamp + 300n,
            onApproval: (approval: ValidatedTimelockApproval) => {
              issued.push(approval);
              saved = JSON.stringify(
                issued,
                (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
                2,
              );
              saveRecovery(saved);
              if (!alive.current) throw new Error("Account changed after approval; reconcile it before execution.");
            },
          };
        }
        const result = await action.mutateAsync({
          account,
          chainId: context.chainId,
          calls: [
            { functionName: "allocate", args: [amount1] },
            { functionName: "allocate", args: [amount2] },
          ],
          timelock: { calls: [authorization(), authorization()] },
        });
        setHash(result.hash);
        if (result.receipt?.status === "success") saveRecovery(null);
        else if (saved)
          saveRecovery(JSON.stringify({ approvals: JSON.parse(saved), transactionHash: result.hash }, null, 2));
      });
    } catch (failure) {
      const transactionHash = recoveryTransactionHash(failure);
      if (transactionHash && saved)
        saveRecovery(JSON.stringify({ approvals: JSON.parse(saved), transactionHash }, null, 2));
      if (alive.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      onBusyChange(false);
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="flex flex-col gap-4" data-testid="timelock-batch">
      <h3 className="text-sm font-medium">Atomic protected Core batch</h3>
      <ResultNote>Allocate two amounts in one transaction. Each locked call receives its own approval.</ResultNote>
      <AmountField id="timelock-batch-first" label="First amount" value={first} onChange={setFirst} decimals={18} />
      <AmountField id="timelock-batch-second" label="Second amount" value={second} onChange={setSecond} decimals={18} />
      <Button
        disabled={amount1 === undefined || amount2 === undefined || !context.ready || Boolean(recovery) || busy}
        onClick={() => void submit()}
      >
        {busy ? "Waiting for approvals and confirmation…" : "Authorize and execute batch"}
      </Button>
      {error ? <ResultError message={error} /> : null}
      {hash ? <ResultSuccess>Transaction: {hash}</ResultSuccess> : null}
    </section>
  );
}
