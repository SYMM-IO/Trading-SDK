"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import type { ExecuteProtectedFunctionParameters, ProtectedFunctionCall } from "@symmio/trading-core";
import {
  useProtectedFunction,
  useProtectedFunctionCatalog,
  useProtectedFunctionEncoder,
  useTimelockApprovalProvider,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Textarea } from "@symmio/ui/components/textarea";
import { useEffect, useRef, useState } from "react";
import { isAddress, isAddressEqual, type AbiParameter, type Address } from "viem";
import { recoveryTransactionHash, withTimelockAttemptLock } from "./timelock-recovery";
import type { TimelockContext } from "./use-timelock-context";

/** Parse JSON arguments according to the SDK ABI; integer strings retain full precision. */
function convertArgument(parameter: AbiParameter, value: unknown): unknown {
  const array = parameter.type.match(/^(.*)\[(\d*)\]$/);
  if (array) {
    if (!Array.isArray(value)) throw new Error(`${parameter.name || parameter.type} must be an array.`);
    if (array[2] && value.length !== Number(array[2]))
      throw new Error(`${parameter.name || parameter.type} has the wrong array length.`);
    return value.map((item) => convertArgument({ ...parameter, type: array[1]! } as AbiParameter, item));
  }
  if (parameter.type === "tuple" && "components" in parameter) {
    if (!value || typeof value !== "object")
      throw new Error(`${parameter.name || "tuple"} must be an object or array.`);
    return parameter.components.map((component, index) =>
      convertArgument(
        component,
        Array.isArray(value) ? value[index] : (value as Record<string, unknown>)[component.name ?? ""],
      ),
    );
  }
  if (/^u?int\d*$/.test(parameter.type)) {
    if (typeof value === "number" && !Number.isSafeInteger(value))
      throw new Error("Large integers must be decimal strings.");
    if ((typeof value !== "string" && typeof value !== "number") || !/^-?\d+$/.test(String(value)))
      throw new Error(`${parameter.name || parameter.type} must be an integer.`);
    return BigInt(value);
  }
  return value;
}

/** Named inspector for each of the SDK's 22 protected functions. */
export function TimelockNamedFunction({
  account,
  owner,
  context,
  recovery,
  storageKey,
  saveRecovery,
  onBusyChange,
}: {
  account: Address;
  owner: Address;
  context: TimelockContext;
  recovery: string | null;
  storageKey: string;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const catalog = useProtectedFunctionCatalog();
  const [name, setName] = useState(catalog[0]!.name);
  const [input, setInput] = useState("[]");
  const [error, setError] = useState<string>();
  const [hash, setHash] = useState<string>();
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const selected = catalog.find((item) => item.name === name)!;
  const provider = useTimelockApprovalProvider({ chainId: context.chainId, solverId: context.solverId });
  const action = useProtectedFunction();
  const encode = useProtectedFunctionEncoder();
  async function submit() {
    if (!context.capability || !context.ready || recovery || busy) return;
    let args: unknown[];
    try {
      const parsed: unknown = JSON.parse(input);
      if (!Array.isArray(parsed) || parsed.length !== selected.inputs.length)
        throw new Error(`Provide ${selected.inputs.length} arguments in order.`);
      args = selected.inputs.map((parameter, index) => convertArgument(parameter, parsed[index]));
      encode({ target: selected.target, functionName: selected.name, args } as unknown as ProtectedFunctionCall);
      if (
        selected.target === "account-layer" &&
        (typeof args[0] !== "string" || !isAddress(args[0]) || !isAddressEqual(args[0], account))
      )
        throw new Error("The first argument must match the selected account.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      return;
    }
    const capability = context.capability;
    setBusy(true);
    onBusyChange(true);
    setError(undefined);
    setHash(undefined);
    let saved: string | undefined;
    try {
      await withTimelockAttemptLock(storageKey, async () => {
        const block = await context.config.getClient({ chainId: context.chainId }).getBlock();
        if (!alive.current) throw new Error("Account changed before the approval request.");
        const variables = {
          account,
          chainId: context.chainId,
          from: owner,
          target: selected.target,
          functionName: selected.name,
          args,
          timelock: {
            capability,
            provider: {
              requestApproval: async (
                request: Parameters<typeof provider.requestApproval>[0],
                options?: Parameters<typeof provider.requestApproval>[1],
              ) => {
                if (!alive.current) throw new Error("Account changed before the approval request.");
                saveRecovery("An approval request was sent. Reconcile its outcome before trying again.");
                return provider.requestApproval(request, options);
              },
            },
            deadline: block.timestamp + 300n,
            onApproval: (approval: unknown) => {
              saved = JSON.stringify(
                approval,
                (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value),
                2,
              );
              saveRecovery(saved);
              if (!alive.current) throw new Error("Account changed after approval; reconcile it before execution.");
            },
          },
        } as unknown as ExecuteProtectedFunctionParameters;
        const result = await action.mutateAsync(variables);
        setHash(result.hash);
        if (result.receipt?.status === "success") saveRecovery(null);
        else if (saved)
          saveRecovery(JSON.stringify({ approval: JSON.parse(saved), transactionHash: result.hash }, null, 2));
      });
    } catch (failure) {
      const transactionHash = recoveryTransactionHash(failure);
      if (transactionHash && saved)
        saveRecovery(JSON.stringify({ approval: JSON.parse(saved), transactionHash }, null, 2));
      if (alive.current) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (alive.current) setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <section
      className="border-border/70 flex flex-col gap-4 rounded-xl border p-4"
      data-testid="timelock-named-function"
    >
      <h3 className="text-sm font-medium">Protected function</h3>
      <ResultNote>
        Select a function and enter its ABI arguments as a JSON array. Enter large integers as decimal strings; values
        stay in contract units.
      </ResultNote>
      <Select
        value={name}
        onValueChange={(value) => {
          setName(value);
          setInput("[]");
        }}
        disabled={busy || Boolean(recovery)}
      >
        <SelectTrigger aria-label="Protected function">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {catalog.map((item) => (
            <SelectItem key={`${item.target}:${item.name}`} value={item.name}>
              {item.target} · {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Field
        label="Arguments"
        htmlFor="timelock-named-arguments"
        hint={selected.inputs.map((item) => `${item.name || "argument"}: ${item.type}`).join(", ") || "No arguments"}
      >
        <Textarea
          id="timelock-named-arguments"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="font-mono text-xs"
        />
      </Field>
      <Button disabled={!context.ready || Boolean(recovery) || busy} onClick={() => void submit()}>
        {busy ? "Waiting for confirmation…" : "Request approval and execute"}
      </Button>
      {error ? <ResultError message={error} /> : null}
      {hash ? <ResultSuccess>Transaction: {hash}</ResultSuccess> : null}
    </section>
  );
}
