"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useGaslessWriteOption } from "@/features/gasless/gasless-write-mode-store";
import {
  parseGaslessErrorDetail,
  useCancelTimelockOp,
  useExecuteTimelockOp,
  useScheduledCallMatch,
  useScheduleTimelockOp,
  useSubAccount,
  useTimelockScheduleState,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Textarea } from "@symmio/ui/components/textarea";
import { useEffect, useState } from "react";
import { isAddressEqual, type Hex } from "viem";
import { readScheduledRecovery, recoveryTransactionHash, withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

function formatCooldown(seconds: bigint): string {
  const hours = seconds / 3600n;
  const minutes = (seconds % 3600n) / 60n;
  const remaining = seconds % 60n;
  return hours > 0n
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`
    : `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

/** Advanced exact-calldata recovery, matching the console's other low-level write tools. */
export function TimelockSchedulePanel({
  context,
  recovery,
  saveRecovery,
  onBusyChange,
  storageKey,
  initialCallData,
  initialInnerCallData,
  cardWriteMode = false,
  writeMethod = "timelockScheduleRecovery",
  guidedPolicyClear = false,
  externalBusy = false,
  onExecuteSuccess,
}: {
  context: TimelockContext;
  recovery: string | null;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
  storageKey: string;
  initialCallData?: Hex;
  initialInnerCallData?: Hex;
  cardWriteMode?: boolean;
  writeMethod?: string;
  guidedPolicyClear?: boolean;
  externalBusy?: boolean;
  onExecuteSuccess?: () => void;
}) {
  const saved = readScheduledRecovery(recovery);
  const [rawInput, setRaw] = useState(initialCallData ?? "");
  const [innerInput, setInner] = useState(initialInnerCallData ?? "");
  const raw = saved?.callData ?? rawInput;
  const inner = saved?.innerCallData ?? innerInput;
  const blocked = Boolean(recovery && !saved?.confirmed);
  const [localError, setLocalError] = useState<string>();
  const [now, setNow] = useState<bigint>();
  const [sampledAt, setSampledAt] = useState<number>();
  const [displayTime, setDisplayTime] = useState(() => Date.now());
  const wallet = useWalletAccount();
  const account = context.rootAccount!;
  const root = useSubAccount({ account, chainId: context.chainId });
  const validRaw = /^0x(?:[\da-fA-F]{2}){4,}$/.test(raw);
  const validInner = /^0x(?:[\da-fA-F]{2}){4,}$/.test(inner);
  const matches = useScheduledCallMatch(
    context.account!,
    validRaw ? (raw as Hex) : "0x",
    validInner ? (inner as Hex) : "0x",
  );
  const schedule = useScheduleTimelockOp();
  const cancel = useCancelTimelockOp();
  const execute = useExecuteTimelockOp();
  const cardWrite = useGaslessWriteOption(writeMethod);
  const state = useTimelockScheduleState({
    account,
    chainId: context.chainId,
    callData: validRaw ? (raw as Hex) : "0x",
    query: { enabled: validRaw, retry: false, refetchInterval: 5_000 },
  });
  const busy = schedule.isPending || cancel.isPending || execute.isPending;
  const isOwner = Boolean(wallet.address && root.data?.owner && isAddressEqual(wallet.address, root.data.owner));
  const canWrite =
    isOwner && wallet.isOnExpectedChain && wallet.chainId === context.chainId && !busy && !blocked && !externalBusy;
  const readyAt = state.data?.readyAt;
  const expiresAt = state.data?.expiresAt;
  const hasSchedule = state.data !== undefined && state.data.schedule.scheduledAt !== 0n;
  const missingSavedSchedule = Boolean(saved?.confirmed && state.isSuccess && !hasSchedule);
  const ready =
    !missingSavedSchedule &&
    (state.data?.requiresSchedule === false ||
      (hasSchedule && readyAt != null && expiresAt != null && now !== undefined && now >= readyAt && now <= expiresAt));
  const expired = expiresAt != null && now !== undefined && now > expiresAt;
  const displayNow =
    now !== undefined && sampledAt !== undefined
      ? now + BigInt(Math.max(0, Math.floor((displayTime - sampledAt) / 1000)))
      : undefined;
  const remaining =
    readyAt !== null && readyAt !== undefined && displayNow !== undefined && readyAt > displayNow
      ? readyAt - displayNow
      : 0n;
  const executionRemaining =
    expiresAt != null && displayNow !== undefined && expiresAt > displayNow ? expiresAt - displayNow : 0n;
  const error = state.error ?? schedule.error ?? cancel.error ?? execute.error;
  const write = {
    account,
    chainId: context.chainId,
    from: wallet.address,
    ...(cardWriteMode ? cardWrite : { gasless: false as const }),
  };

  async function submit(action: "schedule" | "cancel" | "execute") {
    if (!canWrite || !validRaw || (action !== "cancel" && (!validInner || !matches))) return;
    setLocalError(undefined);
    onBusyChange(true);
    let ownsRecord = false;
    try {
      await withTimelockAttemptLock(
        storageKey,
        async () => {
          const record = {
            kind: "scheduled-operation",
            confirmed: false,
            callData: raw,
            innerCallData: inner,
            originalAccount: context.account,
          };
          saveRecovery(JSON.stringify(record));
          ownsRecord = true;
          if (action === "schedule") {
            await schedule.mutateAsync({ ...write, callData: raw as Hex });
            saveRecovery(JSON.stringify({ ...record, confirmed: true }));
          } else if (action === "cancel") {
            await cancel.mutateAsync({ ...write, callData: raw as Hex });
            saveRecovery(null);
          } else {
            const result = await execute.mutateAsync({ ...write, innerCallData: inner as Hex, approvals: [] });
            saveRecovery(null);
            if (result.receipt?.status === "success") onExecuteSuccess?.();
          }
        },
        recovery,
      );
    } catch (error) {
      let definiteSimulationRejection = false;
      if (guidedPolicyClear && !recoveryTransactionHash(error)) {
        let current: unknown = error;
        for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
          const item = current as { status?: unknown; cause?: unknown };
          if (item.status === 400 && parseGaslessErrorDetail(current)?.code === "SIMULATION_REVERTED") {
            definiteSimulationRejection = true;
            break;
          }
          current = item.cause;
        }
      }
      if (
        ownsRecord &&
        ((error && typeof error === "object" && "kind" in error && error.kind === "user-rejected") ||
          definiteSimulationRejection)
      ) {
        try {
          saveRecovery(recovery);
          if (definiteSimulationRejection) {
            schedule.reset();
            cancel.reset();
            execute.reset();
          }
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
        if (active) {
          setNow(block.timestamp);
          setSampledAt(Date.now());
          setDisplayTime(Date.now());
        }
      } catch {
        if (active) setNow(undefined);
      }
    }
    void refreshTime();
    const timer = setInterval(() => void refreshTime(), 5_000);
    const displayTimer = setInterval(() => setDisplayTime(Date.now()), 1_000);
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(displayTimer);
    };
  }, [context.config, context.chainId]);

  return (
    <section className="border-border/70 flex flex-col gap-4 rounded-xl border p-4" data-testid="timelock-schedule">
      <h3 className="text-sm font-medium">
        {guidedPolicyClear ? "Clear selector policy" : "Delayed recovery · exact calldata"}
      </h3>
      <ResultNote>
        {guidedPolicyClear
          ? "Schedule the removal, wait for the existing cooldown, then execute it."
          : "This advanced path requires native gas: schedule → wait → execute. A solver rejection is not permission to bypass it. Resolve any uncertain approval or transaction before using this path."}
      </ResultNote>
      {!guidedPolicyClear ? (
        <>
          <ResultNote>
            Do not schedule calldata containing a short-lived Muon signature, such as deallocation or margin removal:
            the signature can expire before the cooldown finishes.
          </ResultNote>
          <Field
            label="Raw operation calldata"
            htmlFor="timelock-raw"
            hint="Use the exact raw Core or AccountLayer call, not its hash. Keep these bytes to recover after a reload."
          >
            <Textarea
              id="timelock-raw"
              value={raw}
              disabled={busy || Boolean(saved) || Boolean(initialCallData)}
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
              disabled={busy || Boolean(saved) || Boolean(initialInnerCallData)}
              onChange={(event) => setInner(event.target.value.trim())}
              className="font-mono text-xs"
            />
          </Field>
        </>
      ) : null}
      {validRaw && validInner && !matches ? (
        <ResultError message="Execution calldata does not match the selected account and scheduled raw call." />
      ) : null}
      {missingSavedSchedule ? (
        <ResultWarning>
          The saved schedule was not found on chain. It may have been cancelled or invalidated. Verify its status before
          clearing the saved recovery record.
        </ResultWarning>
      ) : null}
      {state.data?.requiresSchedule === false && !missingSavedSchedule ? (
        <ResultNote>This policy change does not require a schedule.</ResultNote>
      ) : null}
      {execute.data?.receipt?.status !== "success" && hasSchedule && readyAt != null ? (
        <ResultNote>
          {expired
            ? "Schedule expired."
            : ready
              ? executionRemaining > 0n
                ? `Cooldown complete. Execute within ${formatCooldown(executionRemaining)}.`
                : "Cooldown complete. Checking the execution window…"
              : "Waiting for the on-chain cooldown."}
        </ResultNote>
      ) : null}
      {execute.data?.receipt?.status !== "success" ? (
        <div className="flex flex-wrap gap-2">
          {!ready && hasSchedule && !expired ? (
            <Button disabled>
              {remaining > 0n ? `Cooldown · ${formatCooldown(remaining)}` : "Checking cooldown…"}
            </Button>
          ) : ready ? (
            <Button
              disabled={
                !canWrite ||
                !validInner ||
                !matches ||
                Boolean(state.error) ||
                Boolean(execute.error && execute.error.kind !== "user-rejected") ||
                execute.isSuccess
              }
              onClick={() => void submit("execute")}
            >
              Execute
            </Button>
          ) : (
            <Button
              disabled={
                !canWrite ||
                !validRaw ||
                !validInner ||
                !matches ||
                state.data?.requiresSchedule === false ||
                Boolean(saved) ||
                !state.isSuccess ||
                Boolean(state.error) ||
                (hasSchedule && !expired) ||
                Boolean(schedule.error && schedule.error.kind !== "user-rejected")
              }
              onClick={() => void submit("schedule")}
            >
              Start cooldown
            </Button>
          )}
          <Button
            variant="outline"
            disabled={
              !canWrite ||
              !hasSchedule ||
              now === undefined ||
              Boolean(cancel.error && cancel.error.kind !== "user-rejected")
            }
            onClick={() => void submit("cancel")}
          >
            Cancel cooldown
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled>Start cooldown</Button>
          <Button variant="outline" disabled>
            Cancel cooldown
          </Button>
        </div>
      )}
      {error ? <ResultError kind={error.code ?? error.kind} message={error.message} /> : null}
      {localError && !error ? <ResultError message={localError} /> : null}
      {[schedule, cancel, execute].map((mutation, index) =>
        mutation.data?.receipt ? (
          <ResultSuccess key={index}>
            {
              [
                "Schedule confirmed.",
                "Cancellation confirmed.",
                guidedPolicyClear
                  ? "Policy removal confirmed."
                  : "Operation confirmed. Core withdrawal cooldown may still apply.",
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
