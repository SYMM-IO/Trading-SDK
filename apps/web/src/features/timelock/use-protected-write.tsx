"use client";

import { ResultError, ResultWarning } from "@/components/result";
import type { TimelockAuthorization } from "@symmio/trading-core";
import { useTimelockSelector } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { useState } from "react";
import type { Address, Hash } from "viem";
import { TimelockPolicyPanel } from "./timelock-policy-panel";
import { useTimelockAttempt } from "./use-timelock-attempt";
import { useTimelockContext } from "./use-timelock-context";

/** Keep inspector writes usable for both unlocked and protected selectors. */
export function useProtectedWrite(account: Address | undefined, owner: Address | undefined, functionName: string) {
  const context = useTimelockContext(account);
  const journal = useTimelockAttempt(context, owner);
  const selector = useTimelockSelector(functionName);
  const policy = context.policy.data?.selectors.find((item) => item.selector === selector);
  const locked = policy !== undefined && policy.status !== "missing";
  const available =
    context.chainUnsupported ||
    (journal.loaded &&
      !journal.recovery &&
      !journal.error &&
      (context.unsupported ||
        Boolean(
          context.capability &&
          !context.info.error &&
          !context.policy.error &&
          policy &&
          (!locked || (policy.status === "ok" && context.indexingAcknowledged)),
        )));
  const [error, setError] = useState<string>();

  async function run(
    action: (authorization?: TimelockAuthorization) => Promise<{ hash: Hash; receipt?: { status: string } }>,
  ) {
    if (!available) return;
    setError(undefined);
    try {
      if (!locked) {
        await action();
        return;
      }
      await journal.run(async () => {
        const [authorization] = await journal.begin(1);
        const result = await action(authorization);
        if (result.receipt?.status === "success") journal.clear();
        else journal.submitted(result.hash);
      });
    } catch (failure) {
      journal.failed(failure);
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }
  return { context, journal, available, error, run };
}

/** Shared policy and recovery controls for an inspector write. */
export function ProtectedWriteNotice({ protection }: { protection: ReturnType<typeof useProtectedWrite> }) {
  const { context, journal, error } = protection;
  return (
    <>
      {!context.unsupported ? <TimelockPolicyPanel context={context} /> : null}
      {journal.error || error ? <ResultError message={journal.error ?? error ?? ""} /> : null}
      {journal.recovery ? (
        <ResultWarning>
          An earlier protected operation needs reconciliation before another attempt.
          <details>
            <summary>Saved recovery details</summary>
            <pre className="max-h-64 overflow-auto text-xs break-all whitespace-pre-wrap">{journal.recovery}</pre>
          </details>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm("Have you reconciled every listed approval and transaction?"))
                void journal.clearReviewed();
            }}
          >
            Clear after reconciliation
          </Button>
        </ResultWarning>
      ) : null}
    </>
  );
}
