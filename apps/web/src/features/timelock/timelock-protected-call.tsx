"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { useProtectedCall, useTimelockApprovalProvider } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { useEffect, useRef, useState } from "react";
import { isHex, type Address, type Hex } from "viem";
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

/** Advanced exact-call card for protected functions without a dedicated action card. */
export function TimelockProtectedCall({ account, context, recovery, saveRecovery, onBusyChange, storageKey }: Props) {
  const [target, setTarget] = useState<"core" | "account-layer">("core");
  const [raw, setRaw] = useState("");
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
  const action = useProtectedCall();
  const provider = useTimelockApprovalProvider({ chainId: context.chainId, solverId: context.solverId });
  const valid = isHex(raw) && raw.length >= 10 && raw.length % 2 === 0;
  async function submit() {
    const capability = context.capability;
    if (!valid || !capability || !context.ready || recovery || busy) return;
    setBusy(true);
    onBusyChange(true);
    setError(undefined);
    setHash(undefined);
    let savedApproval: string | undefined;
    try {
      await withTimelockAttemptLock(storageKey, async () => {
        saveRecovery("A protected operation is being prepared. Reconcile its outcome before trying again.");
        const block = await context.config.getClient({ chainId: context.chainId }).getBlock();
        if (!alive.current) throw new Error("Account changed before the approval request.");
        const result = await action.mutateAsync({
          account,
          chainId: context.chainId,
          target,
          callData: raw as Hex,
          timelock: {
            capability,
            provider,
            deadline: block.timestamp + 300n,
            onApproval: (approval) => {
              savedApproval = JSON.stringify(
                approval,
                (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
                2,
              );
              saveRecovery(savedApproval);
              if (!alive.current) throw new Error("Account changed after approval; reconcile it before execution.");
            },
          },
        });
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
    <section className="flex flex-col gap-4" data-testid="timelock-protected-call">
      <h3 className="text-sm font-medium">Execute an exact protected call</h3>
      <ResultNote>
        Enter raw calldata for one Core or AccountLayer function. Verify the function and arguments before signing.
      </ResultNote>
      <Select
        value={target}
        onValueChange={(value) => setTarget(value as "core" | "account-layer")}
        disabled={busy || Boolean(recovery)}
      >
        <SelectTrigger aria-label="Call target">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="core">Core</SelectItem>
          <SelectItem value="account-layer">AccountLayer</SelectItem>
        </SelectContent>
      </Select>
      <Field label="Raw calldata" htmlFor="protected-call-data">
        <Input
          id="protected-call-data"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder="0x…"
        />
      </Field>
      <Button disabled={!valid || !context.ready || Boolean(recovery) || busy} onClick={() => void submit()}>
        {busy ? "Waiting for approval and confirmation…" : "Request approval and execute"}
      </Button>
      {error ? <ResultError message={error} /> : null}
      {hash ? <ResultSuccess>Transaction: {hash}</ResultSuccess> : null}
    </section>
  );
}
