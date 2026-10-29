"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { useGaslessWriteOption } from "@/features/gasless/gasless-write-mode-store";
import { AmountField } from "@/features/integration/amount-field";
import { parseAmount } from "@/features/integration/parse-amount";
import {
  useAddMargin,
  useAllocate,
  useDeallocate,
  useDeleteSubAccount,
  useRemoveMargin,
  useTimelockApprovalProvider,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { recoveryTransactionHash, withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

interface Props {
  account: Address;
  context: TimelockContext;
  recovery: string | null;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  storageKey: string;
}

/** Exercise existing SDK writes against a protected account. */
export function TimelockAccountActions({ account, context, recovery, saveRecovery, onBusyChange, storageKey }: Props) {
  const [method, setMethod] = useState("addMargin");
  const [amount, setAmount] = useState("");
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
  const provider = useTimelockApprovalProvider({ chainId: context.chainId, solverId: context.solverId });
  const add = useAddMargin();
  const remove = useRemoveMargin();
  const allocate = useAllocate();
  const deallocate = useDeallocate();
  const deletion = useDeleteSubAccount();
  const write = useGaslessWriteOption(method);
  const parsed = parseAmount(amount, 18);
  const canSubmit = context.ready && !recovery && !busy && (method === "deleteSubAccount" || parsed !== undefined);

  async function submit() {
    const capability = context.capability;
    if (!canSubmit || !capability) return;
    if (method === "deleteSubAccount" && !window.confirm("Delete this subaccount permanently?")) return;
    setError(undefined);
    setHash(undefined);
    setBusy(true);
    onBusyChange(true);
    let savedApproval: string | undefined;
    try {
      await withTimelockAttemptLock(storageKey, async () => {
        saveRecovery("A protected operation is being prepared. Reconcile its outcome before trying again.");
        const block = await context.config.getClient({ chainId: context.chainId }).getBlock();
        if (!alive.current) throw new Error("Account changed before the approval request.");
        const timelock = {
          capability,
          provider,
          deadline: block.timestamp + 300n,
          onApproval: (approval: unknown) => {
            savedApproval = JSON.stringify(
              approval,
              (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
              2,
            );
            saveRecovery(savedApproval);
            if (!alive.current) throw new Error("Account changed after approval; reconcile it before execution.");
          },
        };
        const common = { chainId: context.chainId, ...write, timelock };
        const result =
          method === "addMargin"
            ? await add.mutateAsync({ virtualAccount: account, amount: parsed!, ...common })
            : method === "removeMargin"
              ? await remove.mutateAsync({ virtualAccount: account, amount: parsed!, ...common })
              : method === "allocate"
                ? await allocate.mutateAsync({ account, amount: parsed!, ...common })
                : method === "deallocate"
                  ? await deallocate.mutateAsync({ account, amount: parsed!, ...common })
                  : await deletion.mutateAsync({ subAccount: account, ...common });
        setHash(result.hash);
        if (result.receipt?.status === "success") saveRecovery(null);
        else if (savedApproval)
          saveRecovery(JSON.stringify({ approval: JSON.parse(savedApproval), transactionHash: result.hash }, null, 2));
      });
    } catch (failure) {
      const transactionHash = recoveryTransactionHash(failure);
      if (transactionHash && savedApproval)
        saveRecovery(JSON.stringify({ approval: JSON.parse(savedApproval), transactionHash }, null, 2));
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" data-testid="timelock-account-actions">
      <h3 className="text-sm font-medium">Protected account actions</h3>
      <ResultNote>
        Select a virtual account for margin actions or a subaccount for allocation and deletion. Amounts use 18-decimal
        Core units.
      </ResultNote>
      <Select value={method} onValueChange={setMethod} disabled={busy || Boolean(recovery)}>
        <SelectTrigger aria-label="Protected action">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["addMargin", "removeMargin", "allocate", "deallocate", "deleteSubAccount"].map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {method !== "deleteSubAccount" ? (
        <AmountField id="timelock-action-amount" label="Amount" value={amount} onChange={setAmount} decimals={18} />
      ) : null}
      <Button disabled={!canSubmit} onClick={() => void submit()}>
        {busy ? "Waiting for approval and confirmation…" : "Request approval and execute"}
      </Button>
      {error ? <ResultError message={error} /> : null}
      {hash ? <ResultSuccess>Transaction: {hash}</ResultSuccess> : null}
    </section>
  );
}
