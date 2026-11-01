"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import {
  useProtectedFunctionCatalog,
  useSelectorTimelock,
  useSetupTimelocks,
  useSubAccount,
  useWalletAccount,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAddress, isAddressEqual, toFunctionSelector, zeroAddress, type Address, type Hex } from "viem";
import { recoveryTransactionHash, withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

/** Direct owner-controlled setup using the SDK's ABI-derived protected-function catalog. */
export function TimelockManualSetup({
  context,
  recovery,
  storageKey,
  saveRecovery,
  onBusyChange,
}: {
  context: TimelockContext;
  recovery: string | null;
  storageKey: string;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const catalog = useProtectedFunctionCatalog();
  const wallet = useWalletAccount();
  const account = context.rootAccount!;
  const root = useSubAccount({ account, chainId: context.chainId });
  const setup = useSetupTimelocks();
  const [unlocker, setUnlocker] = useState("");
  const [delay, setDelay] = useState("");
  const [error, setError] = useState<string>();
  const [policies, setPolicies] = useState<Record<string, "missing" | "existing" | "error">>({});
  const policyChecks = useRef(new Map<Hex, () => Promise<boolean>>());
  const registerCheck = useCallback((selector: Hex, check: () => Promise<boolean>) => {
    policyChecks.current.set(selector, check);
    return () => {
      policyChecks.current.delete(selector);
    };
  }, []);
  const reportPolicy = useCallback((selector: Hex, state: "missing" | "existing" | "error") => {
    setPolicies((previous) => (previous[selector] === state ? previous : { ...previous, [selector]: state }));
  }, []);
  const validUnlocker = isAddress(unlocker) && !isAddressEqual(unlocker, zeroAddress);
  const validDelay = /^\d+$/.test(delay);
  const isOwner = Boolean(wallet.address && root.data?.owner && isAddressEqual(wallet.address, root.data.owner));
  const selectors = catalog.map(({ name, inputs }) =>
    toFunctionSelector({ type: "function", name, inputs, outputs: [], stateMutability: "nonpayable" }),
  );
  const checked = selectors.every((selector) => policies[selector] !== undefined);
  const existingPolicy = selectors.some((selector) => policies[selector] === "existing");
  const missingPolicy = selectors.some((selector) => policies[selector] === "missing");
  const policyError = selectors.some((selector) => policies[selector] === "error");
  const canSubmit =
    checked &&
    missingPolicy &&
    !policyError &&
    validUnlocker &&
    validDelay &&
    isOwner &&
    wallet.isOnExpectedChain &&
    wallet.chainId === context.chainId &&
    !recovery &&
    !setup.isPending &&
    !setup.isSuccess;

  async function submit() {
    if (!canSubmit || !isAddress(unlocker)) return;
    setError(undefined);
    onBusyChange(true);
    let ownsRecord = false;
    let attemptedSelectors: Hex[] = [];
    try {
      await withTimelockAttemptLock(storageKey, async () => {
        const checks = selectors.map((selector) => policyChecks.current.get(selector));
        if (checks.some((check) => !check)) throw new Error("Could not verify all existing policies.");
        const empty = await Promise.all(checks.map((check) => check!()));
        const missingSelectors = selectors.filter((_, index) => empty[index]);
        if (!missingSelectors.length) throw new Error("All selector policies are already configured.");
        attemptedSelectors = missingSelectors;
        saveRecovery(
          JSON.stringify({ kind: "setup-selector-policy", account, unlocker, delay, selectors: missingSelectors }),
        );
        ownsRecord = true;
        const result = await setup.mutateAsync({
          account,
          chainId: context.chainId,
          from: wallet.address,
          gasless: false,
          unlocker,
          delay: BigInt(delay),
          selectors: missingSelectors,
          ...(context.capability ? { providerMinimumDelay: BigInt(context.capability.minTimelockDelaySeconds) } : {}),
        });
        if (result.receipt?.status === "success") saveRecovery(null);
        else
          saveRecovery(
            JSON.stringify({
              kind: "setup-selector-policy",
              account,
              unlocker,
              delay,
              selectors: missingSelectors,
              transactionHash: result.hash,
            }),
          );
      });
    } catch (failure) {
      const hash = recoveryTransactionHash(failure);
      if (hash)
        saveRecovery(
          JSON.stringify({
            kind: "setup-selector-policy",
            account,
            unlocker,
            delay,
            selectors: attemptedSelectors,
            transactionHash: hash,
          }),
        );
      else if (
        ownsRecord &&
        failure &&
        typeof failure === "object" &&
        (("kind" in failure && failure.kind === "user-rejected") ||
          ("cause" in failure && failure.cause instanceof RangeError))
      )
        saveRecovery(null);
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <section className="border-border/70 flex flex-col gap-4 rounded-xl border p-4" data-testid="timelock-manual-setup">
      {selectors.map((selector) => (
        <SelectorPolicyProbe
          key={selector}
          account={account}
          selector={selector}
          chainId={context.chainId}
          onResult={reportPolicy}
          registerCheck={registerCheck}
        />
      ))}
      <h3 className="text-sm font-medium">Configure protection directly</h3>
      <ResultNote>
        Set the root policy for {selectors.length} protected selectors. Confirm the unlocker and cooldown for this
        deployment before submitting.
      </ResultNote>
      <Field label="Unlocker address" htmlFor="timelock-manual-unlocker">
        <Input
          id="timelock-manual-unlocker"
          value={unlocker}
          onChange={(event) => setUnlocker(event.target.value.trim())}
          placeholder="0x…"
        />
      </Field>
      <Field label="Cooldown (seconds)" htmlFor="timelock-manual-delay">
        <Input
          id="timelock-manual-delay"
          value={delay}
          onChange={(event) => setDelay(event.target.value)}
          inputMode="numeric"
        />
      </Field>
      <ResultNote>
        The contract minimum is checked before submission. Changing an existing policy may require authorization or a
        mature schedule. This action uses the owner wallet and native gas.
      </ResultNote>
      {!checked ? <ResultNote loading>Checking existing selector policies…</ResultNote> : null}
      {existingPolicy ? (
        <ResultNote>
          Existing policies are preserved. This action configures only selectors without protection. To change an
          existing policy, use the policy-change authorization or scheduled path.
        </ResultNote>
      ) : null}
      {policyError ? <ResultError message="Could not verify the existing policy. Refresh and try again." /> : null}
      <Button disabled={!canSubmit} onClick={() => void submit()}>
        {setup.isPending ? "Confirming setup…" : "Configure protection"}
      </Button>
      {error ? <ResultError message={error} /> : null}
      {setup.data?.receipt ? (
        <TxReceipt
          hash={setup.data.hash}
          receipt={{ blockNumber: setup.data.receipt.blockNumber, status: setup.data.receipt.status }}
        />
      ) : null}
    </section>
  );
}

function SelectorPolicyProbe({
  account,
  selector,
  chainId,
  onResult,
  registerCheck,
}: {
  account: Address;
  selector: Hex;
  chainId: number;
  onResult: (selector: Hex, state: "missing" | "existing" | "error") => void;
  registerCheck: (selector: Hex, check: () => Promise<boolean>) => () => void;
}) {
  const policy = useSelectorTimelock({ account, selector, chainId, query: { retry: false } });
  const { refetch } = policy;
  useEffect(
    () =>
      registerCheck(selector, async () => {
        const result = await refetch();
        if (result.error || !result.data) throw new Error("Could not verify the existing selector policy.");
        return isAddressEqual(result.data.unlocker, zeroAddress);
      }),
    [registerCheck, selector, refetch],
  );
  const status = policy.isError
    ? "error"
    : policy.data
      ? isAddressEqual(policy.data.unlocker, zeroAddress)
        ? "missing"
        : "existing"
      : undefined;
  useEffect(() => {
    if (status) onResult(selector, status);
  }, [onResult, selector, status]);
  return null;
}
