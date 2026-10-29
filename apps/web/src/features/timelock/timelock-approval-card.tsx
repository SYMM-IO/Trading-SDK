"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import { useRequestTimelockApproval, useTimelockApprovalProvider } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { useEffect, useRef, useState } from "react";
import { isHex, type Address, type Hex } from "viem";
import { withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

interface Props {
  account: Address;
  context: TimelockContext;
  recovery: string | null;
  storageKey: string;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}

/** Request one approval without executing it, for independent SDK-hook testing. */
export function TimelockApprovalCard({ account, context, recovery, storageKey, saveRecovery, onBusyChange }: Props) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const provider = useTimelockApprovalProvider({ chainId: context.chainId, solverId: context.solverId });
  const request = useRequestTimelockApproval();
  const valid = isHex(raw) && raw.length >= 10 && raw.length % 2 === 0;
  async function submit() {
    const capability = context.capability;
    const root = context.policy.data?.rootAccount;
    if (!valid || !capability || !root || !context.ready || recovery || busy) return;
    setBusy(true);
    setError(undefined);
    setSaved(false);
    onBusyChange(true);
    try {
      await withTimelockAttemptLock(storageKey, async () => {
        saveRecovery("An approval request is being prepared. Reconcile its outcome before trying again.");
        const block = await context.config.getClient({ chainId: context.chainId }).getBlock();
        if (!alive.current) throw new Error("Account changed before the approval request.");
        const approval = await request.mutateAsync({
          account,
          rootAccount: root,
          chainId: context.chainId,
          capability,
          provider,
          callData: raw as Hex,
          deadline: block.timestamp + 300n,
        });
        saveRecovery(
          JSON.stringify(approval, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2),
        );
        if (alive.current) setSaved(true);
      });
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      onBusyChange(false);
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="flex flex-col gap-4" data-testid="timelock-request-approval">
      <h3 className="text-sm font-medium">Request an approval only</h3>
      <ResultNote>
        This issues a single-use approval without executing the call. Save and reconcile it before requesting another.
      </ResultNote>
      <Field label="Raw calldata" htmlFor="timelock-request-data">
        <Input
          id="timelock-request-data"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder="0x…"
        />
      </Field>
      <Button disabled={!valid || !context.ready || Boolean(recovery) || busy} onClick={() => void submit()}>
        {busy ? "Requesting approval…" : "Request approval"}
      </Button>
      {error ? <ResultError message={error} /> : null}
      {request.data && saved ? <ResultSuccess>Approval issued and saved for reconciliation.</ResultSuccess> : null}
      {request.data && !saved ? (
        <ResultWarning>
          The approval was issued but could not be saved. Copy these details before leaving this page.
          <pre className="max-h-64 overflow-auto text-xs break-all whitespace-pre-wrap">
            {JSON.stringify(
              request.data,
              (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
              2,
            )}
          </pre>
        </ResultWarning>
      ) : null}
    </section>
  );
}
