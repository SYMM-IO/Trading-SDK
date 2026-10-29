"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import {
  useCancelTimelockOp,
  useExecuteTimelockOp,
  useScheduledCallMatch,
  useScheduleTimelockOp,
  useSubAccount,
  useTimelockScheduleState,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Checkbox } from "@symmio/ui/components/checkbox";
import { Label } from "@symmio/ui/components/label";
import { Textarea } from "@symmio/ui/components/textarea";
import { useEffect, useState } from "react";
import { isAddressEqual, type Hex } from "viem";
import { readScheduledRecovery, withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

/** Advanced exact-calldata recovery, matching the console's other low-level write tools. */
export function TimelockSchedulePanel({
  context,
  recovery,
  saveRecovery,
  onBusyChange,
  storageKey,
}: {
  context: TimelockContext;
  recovery: string | null;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  storageKey: string;
}) {
  const saved = readScheduledRecovery(recovery);
  const [rawInput, setRaw] = useState("");
  const [innerInput, setInner] = useState("");
  const raw = saved?.callData ?? rawInput;
  const inner = saved?.innerCallData ?? innerInput;
  const blocked = Boolean(recovery && !saved?.confirmed);
  const [localError, setLocalError] = useState<string>();
  const [unavailable, setUnavailable] = useState(false);
  const [now, setNow] = useState<bigint>();
  const wallet = useWalletAccount();
  const account = context.policy.data!.rootAccount;
  const root = useSubAccount({ account, chainId: context.chainId });
  const validRaw = /^0x(?:[\da-fA-F]{2}){4,}$/.test(raw);
  const validInner = /^0x(?:[\da-fA-F]{2}){4,}$/.test(inner);
  const matches = useScheduledCallMatch(
    context.policy.data!.account,
    validRaw ? (raw as Hex) : "0x",
    validInner ? (inner as Hex) : "0x",
  );
  const schedule = useScheduleTimelockOp();
  const cancel = useCancelTimelockOp();
  const execute = useExecuteTimelockOp();
  const state = useTimelockScheduleState({
    account,
    chainId: context.chainId,
    callData: validRaw ? (raw as Hex) : "0x",
    query: { enabled: validRaw, retry: false, refetchInterval: 5_000 },
  });
  const busy = schedule.isPending || cancel.isPending || execute.isPending;
  const isOwner = Boolean(wallet.address && root.data?.owner && isAddressEqual(wallet.address, root.data.owner));
  const canWrite = isOwner && wallet.isOnExpectedChain && wallet.chainId === context.chainId && !busy && !blocked;
  const readyAt = state.data?.readyAt;
  const expiresAt = state.data?.expiresAt;
  const hasSchedule = state.data !== undefined && state.data.schedule.scheduledAt !== 0n;
  const ready =
    state.data?.requiresSchedule === false ||
    (hasSchedule && readyAt != null && expiresAt != null && now !== undefined && now >= readyAt && now <= expiresAt);
  const expired = expiresAt != null && now !== undefined && now > expiresAt;
  const error = state.error ?? schedule.error ?? cancel.error ?? execute.error;
  const write = { account, chainId: context.chainId, from: wallet.address, gasless: false as const };

  async function submit(action: "schedule" | "cancel" | "execute") {
    if (!canWrite || !validRaw || (action !== "cancel" && (!validInner || !matches))) return;
    setLocalError(undefined);
    onBusyChange(true);
    let ownsRecord = false;
    try {
      await withTimelockAttemptLock(
        storageKey,
        async () => {
          const record = { kind: "scheduled-operation", confirmed: false, callData: raw, innerCallData: inner };
          saveRecovery(JSON.stringify(record));
          ownsRecord = true;
          if (action === "schedule") {
            await schedule.mutateAsync({ ...write, callData: raw as Hex });
            saveRecovery(JSON.stringify({ ...record, confirmed: true }));
          } else if (action === "cancel") {
            await cancel.mutateAsync({ ...write, callData: raw as Hex });
            saveRecovery(null);
          } else {
            await execute.mutateAsync({ ...write, innerCallData: inner as Hex, approvals: [] });
            saveRecovery(null);
          }
        },
        recovery,
      );
    } catch (error) {
      if (ownsRecord && error && typeof error === "object" && "kind" in error && error.kind === "user-rejected") {
        try {
          saveRecovery(recovery);
        } catch {
          /* Keep recovery blocked when storage is unavailable. */
        }
      }
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      onBusyChange(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function refreshTime() {
      try {
        const block = await context.config.getClient({ chainId: context.chainId }).getBlock();
        if (active) setNow(block.timestamp);
      } catch {
        if (active) setNow(undefined);
      }
    }
    void refreshTime();
    const timer = setInterval(() => void refreshTime(), 5_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [context.config, context.chainId]);

  return (
    <section className="border-border/70 flex flex-col gap-4 rounded-xl border p-4" data-testid="timelock-schedule">
      <h3 className="text-sm font-medium">Delayed recovery · exact calldata</h3>
      <ResultNote>
        This advanced path requires native gas: schedule → wait → execute. A solver rejection is not permission to
        bypass it. Resolve any uncertain approval or transaction before using this path.
      </ResultNote>
      <ResultNote>
        Do not schedule calldata containing a short-lived Muon signature, such as deallocation or margin removal: the
        signature can expire before the cooldown finishes.
      </ResultNote>
      <Field
        label="Raw operation calldata"
        htmlFor="timelock-raw"
        hint="Use the exact raw Core or AccountLayer call, not its hash. Keep these bytes to recover after a reload."
      >
        <Textarea
          id="timelock-raw"
          value={raw}
          disabled={busy || Boolean(saved)}
          onChange={(event) => {
            setRaw(event.target.value.trim());
            schedule.reset();
            cancel.reset();
            execute.reset();
          }}
          className="font-mono text-xs"
        />
      </Field>
      <Field
        label="AccountLayer execution calldata"
        htmlFor="timelock-inner"
        hint="For Core: the SDK's _call(originalAccount, [rawCall]) encoding. For AccountLayer: the raw call unchanged. Do not paste an executeTimelockOp wrapper."
      >
        <Textarea
          id="timelock-inner"
          value={inner}
          disabled={busy || Boolean(saved)}
          onChange={(event) => setInner(event.target.value.trim())}
          className="font-mono text-xs"
        />
      </Field>
      <Label className="items-start">
        <Checkbox checked={unavailable} onCheckedChange={(checked) => setUnavailable(checked === true)} />
        <span>The approval service is unavailable, and I have reconciled any earlier attempt.</span>
      </Label>
      {validRaw && validInner && !matches ? (
        <ResultError message="Execution calldata does not match the selected account and scheduled raw call." />
      ) : null}
      {state.data?.requiresSchedule === false ? (
        <ResultNote>This policy change does not require a schedule.</ResultNote>
      ) : null}
      {hasSchedule && readyAt != null ? (
        <ResultNote>
          {expired
            ? "Schedule expired."
            : ready
              ? "Cooldown complete; execute before the grace period ends."
              : "Waiting for the on-chain cooldown."}{" "}
          Ready at {readyAt.toString()} · expires at {expiresAt?.toString()} (Unix seconds).
        </ResultNote>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            !canWrite ||
            !unavailable ||
            !validRaw ||
            !validInner ||
            !matches ||
            state.data?.requiresSchedule === false ||
            Boolean(saved) ||
            !state.isSuccess ||
            Boolean(state.error) ||
            (hasSchedule && !expired) ||
            Boolean(schedule.error)
          }
          onClick={() => void submit("schedule")}
        >
          Start cooldown
        </Button>
        <Button
          disabled={
            !canWrite ||
            !validInner ||
            !matches ||
            !ready ||
            Boolean(state.error) ||
            Boolean(execute.error) ||
            execute.isSuccess
          }
          onClick={() => void submit("execute")}
        >
          {state.data?.requiresSchedule === false ? "Execute policy change" : "Execute after cooldown"}
        </Button>
        <Button
          variant="outline"
          disabled={!canWrite || !hasSchedule || now === undefined || Boolean(cancel.error)}
          onClick={() => void submit("cancel")}
        >
          Cancel cooldown
        </Button>
      </div>
      {error ? <ResultError kind={error.code ?? error.kind} message={error.message} /> : null}
      {localError && !error ? <ResultError message={localError} /> : null}
      {[schedule, cancel, execute].map((mutation, index) =>
        mutation.data?.receipt ? (
          <ResultSuccess key={index}>
            {
              [
                "Schedule confirmed.",
                "Cancellation confirmed.",
                "Operation confirmed. Core withdrawal cooldown may still apply.",
              ][index]
            }
            <TxReceipt
              hash={mutation.data.hash}
              receipt={{ blockNumber: mutation.data.receipt.blockNumber, status: mutation.data.receipt.status }}
            />
          </ResultSuccess>
        ) : null,
      )}
    </section>
  );
}
