"use client";

import { ResultError, ResultNote, ResultWarning } from "@/components/result";
import type { ProtectedFunctionCall, TimelockAuthorization } from "@symmio/trading-core";
import {
  useProtectedFunctionEncoder,
  useScheduledCallMatch,
  useTimelockRoute,
  useTimelockSelector,
  useTimelockedCoreCallEncoder,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { useEffect, useId, useRef, useState } from "react";
import { isAddressEqual, sliceHex, zeroAddress, type Address, type Hash } from "viem";
import { readScheduledRecovery } from "./timelock-recovery";
import { useRecoveryNoticeRegistry } from "./timelock-recovery-notices";
import { TimelockSchedulePanel } from "./timelock-schedule-panel";
import { useTimelockAttempt } from "./use-timelock-attempt";
import { useTimelockContext } from "./use-timelock-context";

/** Keep inspector writes usable for both unlocked and protected selectors. */
export function useProtectedWrite(
  account: Address | undefined,
  owner: Address | undefined,
  functionName: string,
  fallbackCall?: ProtectedFunctionCall,
) {
  const safeAccount = account && !isAddressEqual(account, zeroAddress) ? account : undefined;
  const context = useTimelockContext(safeAccount, undefined, owner);
  const journal = useTimelockAttempt(context, owner);
  const selector = useTimelockSelector(functionName);
  const encode = useProtectedFunctionEncoder();
  const wrap = useTimelockedCoreCallEncoder();
  let raw: ReturnType<typeof encode> | undefined;
  try {
    raw = fallbackCall ? encode(fallbackCall) : undefined;
  } catch {
    // Invalid form arguments must not crash the rest of the inspector.
    raw = undefined;
  }
  const inner = raw && safeAccount ? (fallbackCall?.target === "core" ? wrap(safeAccount, raw) : raw) : undefined;
  const automatic =
    !context.chainUnsupported &&
    context.config.getSolver({ chainId: context.chainId, solverId: context.solverId }).capabilities
      ?.timelockApproval === true;
  const routing = useTimelockRoute({
    account: safeAccount,
    owner,
    selector,
    chainId: context.chainId,
    solverId: context.solverId,
    enabled: automatic,
  });
  const { attempt: routeAttempt, clearReconciledAttempt } = routing;
  const observedRecovery = useRef<{ key: string; present: boolean } | undefined>(undefined);
  useEffect(() => {
    const key = journal.storageKey;
    if (!key || !journal.loaded) return;
    const previous = observedRecovery.current;
    if (previous?.key === key && previous.present && !journal.recovery && routeAttempt === "reconcile")
      clearReconciledAttempt();
    observedRecovery.current = { key, present: Boolean(journal.recovery) };
  }, [journal.storageKey, journal.loaded, journal.recovery, routeAttempt, clearReconciledAttempt]);
  const policy = context.policy.data?.selectors.find((item) => item.selector === selector);
  const locked = policy !== undefined && policy.status !== "missing";
  const legacyAvailable =
    !context.checkRecovery ||
    (journal.loaded &&
      !journal.recovery &&
      !journal.error &&
      (context.unsupported ||
        Boolean(context.capability && !context.policy.error && policy && (!locked || policy.status === "ok"))));
  const available = automatic
    ? journal.loaded &&
      !journal.recovery &&
      !journal.error &&
      !routing.attempt &&
      (routing.route.kind === "normal" ||
        routing.route.kind === "delayed" ||
        (routing.route.kind === "approval" && !context.policy.error))
    : legacyAvailable;
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const registry = useRecoveryNoticeRegistry();
  const [confirmedUnavailableScope, setConfirmedUnavailableScope] = useState<string>();
  const delayedScope = `${context.scope}:${selector}`;
  useEffect(() => {
    setError(undefined);
    setErrorCode(undefined);
  }, [safeAccount, selector, raw]);

  async function run(
    action: (authorization?: TimelockAuthorization) => Promise<{ hash: Hash; receipt?: { status: string } }>,
  ) {
    if (!available) return;
    setError(undefined);
    setErrorCode(undefined);
    const activeKey = journal.storageKey;
    let actionFailed = false;
    const runAction = async (authorization?: TimelockAuthorization) => {
      try {
        return await action(authorization);
      } catch (failure) {
        actionFailed = true;
        throw failure;
      }
    };
    setRunning(true);
    if (activeKey) registry?.begin(activeKey);
    try {
      if (!journal.canProceed()) throw new Error("An earlier protected operation needs reconciliation.");
      if (automatic) {
        if (routing.route.kind === "delayed") {
          setError("The approval service is unavailable. Use delayed recovery in Contracts → Timelock.");
          return;
        }
        if (routing.route.kind === "normal") {
          await journal.runNormal(() =>
            routing.run({ normal: () => runAction(), protected: (authorization) => runAction(authorization) }),
          );
          return;
        }
        await journal.run(async () => {
          const authorization = (await journal.begin(1))[0]!;
          if (!("capability" in authorization)) throw new Error("Approval request configuration is unavailable.");
          const routed = await routing.run({
            normal: () => runAction(),
            protected: (authorization) => runAction(authorization),
            deadline: authorization.deadline,
            onApproval: authorization.onApproval,
          });
          if (routed.kind === "submitted" && routing.route.kind === "approval") {
            if (routed.result.receipt?.status === "success") journal.clear();
            else journal.submitted(routed.result.hash);
          }
        });
        return;
      }
      if (!locked) {
        await journal.runNormal(() => runAction());
        return;
      }
      await journal.run(async () => {
        const [authorization] = await journal.begin(1);
        const result = await runAction(authorization);
        if (result.receipt?.status === "success") journal.clear();
        else journal.submitted(result.hash);
      });
    } catch (failure) {
      await journal.failed(failure);
      // The write's existing status panel already renders its errors and handles resets.
      if (!actionFailed) {
        setError(failure instanceof Error ? failure.message : String(failure));
        if (failure && typeof failure === "object" && "code" in failure && typeof failure.code === "string")
          setErrorCode(failure.code);
      }
    } finally {
      if (activeKey) registry?.end(activeKey);
      setRunning(false);
    }
  }
  return {
    context,
    journal,
    routing,
    selector,
    automatic,
    available: available && !fallbackBusy,
    error,
    errorCode,
    run,
    raw,
    inner,
    fallbackBusy,
    setFallbackBusy,
    running,
    confirmedUnavailableScope,
    delayedScope,
    setConfirmedUnavailableScope,
  };
}

/** Shared policy and recovery controls for an inspector write. */
export function ProtectedWriteNotice({ protection }: { protection: ReturnType<typeof useProtectedWrite> }) {
  const registry = useRecoveryNoticeRegistry();
  const noticeId = useId();
  const {
    context,
    journal,
    routing,
    automatic,
    error,
    errorCode,
    raw,
    inner,
    setFallbackBusy,
    confirmedUnavailableScope,
    delayedScope,
    setConfirmedUnavailableScope,
  } = protection;
  const offerDelayed = routing.route.kind === "delayed" || confirmedUnavailableScope === delayedScope;
  const saved = readScheduledRecovery(journal.recovery);
  const savedMatchesAccount = useScheduledCallMatch(
    context.account ?? zeroAddress,
    saved?.callData ?? "0x",
    saved?.innerCallData ?? "0x",
  );
  const savedForOperation =
    saved &&
    saved.originalAccount &&
    context.account &&
    isAddressEqual(saved.originalAccount, context.account) &&
    protection.selector &&
    sliceHex(saved.callData, 0, 4).toLowerCase() === protection.selector.toLowerCase() &&
    savedMatchesAccount;
  const showRecovery = Boolean(journal.recovery && (!automatic || !savedForOperation));
  const clearRef = useRef(journal.clearReviewed);
  clearRef.current = journal.clearReviewed;
  const register = registry?.register;
  const unregister = registry?.unregister;
  useEffect(() => {
    if (!register || !unregister || !showRecovery || !journal.storageKey || !journal.recovery || !context.rootAccount)
      return;
    register(noticeId, {
      key: journal.storageKey,
      account: context.rootAccount,
      recovery: journal.recovery,
      clear: async () => {
        await clearRef.current();
      },
    });
    return () => unregister(noticeId);
  }, [register, unregister, showRecovery, journal.storageKey, journal.recovery, context.rootAccount, noticeId]);
  const inProgress = protection.running || Boolean(journal.storageKey && registry?.active.has(journal.storageKey));
  const selectorPolicy = context.policy.data?.selectors.find((item) => item.selector === protection.selector);
  const needsAttention =
    context.account && selectorPolicy && selectorPolicy.status !== "missing" && selectorPolicy.status !== "ok";
  return (
    <>
      {needsAttention && !journal.error && !error ? (
        <ResultError
          code="TIMELOCK_REQUIRED"
          timelockAccount={context.account}
          message="Review trading protection before this operation."
        />
      ) : null}
      {journal.error || error ? (
        <ResultError code={errorCode} timelockAccount={context.account} message={journal.error ?? error ?? ""} />
      ) : null}
      {automatic && routing.route.kind === "error" ? <ResultError message={routing.route.message} /> : null}
      {automatic && offerDelayed && !raw ? (
        <ResultWarning>
          The approval service is unavailable. Delayed recovery is not available for this operation until its exact
          calldata can be safely prepared.
        </ResultWarning>
      ) : null}
      {automatic &&
      journal.loaded &&
      journal.storageKey &&
      context.rootAccount &&
      context.account &&
      ((offerDelayed && raw && inner && !journal.recovery && !journal.error) || savedForOperation) ? (
        <TimelockSchedulePanel
          key={`${journal.storageKey}:${saved?.callData ?? raw}`}
          context={context}
          recovery={journal.recovery}
          saveRecovery={journal.saveScheduledRecovery}
          onBusyChange={setFallbackBusy}
          storageKey={journal.storageKey}
          initialCallData={saved?.callData ?? raw}
          initialInnerCallData={saved?.innerCallData ?? inner}
        />
      ) : null}
      {showRecovery && inProgress ? <ResultNote loading>Operation in progress for this account.</ResultNote> : null}
      {showRecovery && !inProgress && registry ? (
        <ResultNote>Review the earlier operation for this account in the notice above.</ResultNote>
      ) : null}
      {showRecovery && !inProgress && !registry ? (
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
                void journal.clearReviewed().then((cleared) => {
                  if (cleared) routing.clearReconciledAttempt();
                });
            }}
          >
            Clear after reconciliation
          </Button>
          {automatic && journal.approvalServiceUnavailable && raw && inner ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "Have you reconciled the previous request and confirmed that the approval service is unavailable?",
                  )
                )
                  void journal.clearReviewed().then((cleared) => {
                    if (!cleared) return;
                    routing.clearReconciledAttempt();
                    setConfirmedUnavailableScope(delayedScope);
                  });
              }}
            >
              Use delayed recovery
            </Button>
          ) : null}
        </ResultWarning>
      ) : null}
      {showRecovery && !inProgress && registry && automatic && journal.approvalServiceUnavailable && raw && inner ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (
              window.confirm(
                "Have you reconciled the previous request and confirmed that the approval service is unavailable?",
              )
            )
              void journal.clearReviewed().then((cleared) => {
                if (!cleared) return;
                routing.clearReconciledAttempt();
                setConfirmedUnavailableScope(delayedScope);
              });
          }}
        >
          Use delayed recovery
        </Button>
      ) : null}
    </>
  );
}
