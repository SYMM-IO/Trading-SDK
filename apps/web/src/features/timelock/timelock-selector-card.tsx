"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { SelectorIcon } from "@/features/inspector/instant-layer-icons";
import { accountLayerAbi, useProtectedFunctionCatalog, useSelectorTimelock } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Combobox } from "@symmio/ui/components/combobox";
import { useState } from "react";
import { decodeFunctionData, encodeFunctionData, isAddressEqual, toFunctionSelector, type Hex } from "viem";
import { readScheduledRecovery } from "./timelock-recovery";
import { TimelockSchedulePanel } from "./timelock-schedule-panel";
import type { TimelockContext } from "./use-timelock-context";

/** Inspect a selector and schedule its policy removal without requesting solver approval. */
export function TimelockSelectorCard({
  context,
  disabled,
  recovery,
  storageKey,
  saveRecovery,
  onBusyChange,
}: {
  context: TimelockContext;
  disabled: boolean;
  recovery: string | null;
  storageKey: string;
  saveRecovery: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const account = context.rootAccount!;
  const saved = readScheduledRecovery(recovery);
  let savedSelector: Hex | undefined;
  if (saved && saved.callData === saved.innerCallData) {
    try {
      const decoded = decodeFunctionData({ abi: accountLayerAbi, data: saved.callData });
      if (
        decoded.functionName === "clearTimelocks" &&
        isAddressEqual(decoded.args[0], account) &&
        decoded.args[1].length === 1
      )
        savedSelector = decoded.args[1][0];
    } catch {
      /* A different scheduled operation belongs to its original flow. */
    }
  }
  const selector = savedSelector ?? input;
  const valid = /^0x[\da-fA-F]{8}$/.test(selector);
  const catalog = useProtectedFunctionCatalog();
  const selectorItems = catalog.map((item) => ({
    id: toFunctionSelector({
      type: "function",
      name: item.name,
      inputs: item.inputs,
      outputs: [],
      stateMutability: "nonpayable",
    }),
    title: item.name,
    meta: item.target,
  }));
  const policy = useSelectorTimelock({
    account,
    selector: valid ? (selector as Hex) : "0x00000000",
    chainId: context.chainId,
    query: { enabled: valid, retry: false },
  });
  const callData = valid
    ? encodeFunctionData({ abi: accountLayerAbi, functionName: "clearTimelocks", args: [account, [selector as Hex]] })
    : undefined;
  return (
    <section className="border-border/70 flex flex-col gap-4 rounded-xl border p-4" data-testid="timelock-selector">
      <h3 className="text-sm font-medium">Inspect or clear a selector policy</h3>
      <Field
        label="Function selector"
        htmlFor="timelock-selector-field"
        hint="Four-byte selector, for example 0x12345678."
      >
        <Combobox
          idPrefix="timelock-selector"
          value={selector}
          onValueChange={(value) => setInput(value.trim())}
          onSelect={(item) => setInput(item.id)}
          items={selectorItems}
          placeholder="0x12345678"
          disabled={disabled || Boolean(savedSelector)}
          mono
          invalid={selector.length > 0 && !valid}
          triggerIcon={<SelectorIcon />}
          triggerLabel="Browse timelock selectors"
        />
      </Field>
      {policy.data && valid ? (
        <ResultNote>
          Unlocker: {policy.data.unlocker} · delay: {policy.data.delay.toString()} seconds.
        </ResultNote>
      ) : null}
      {policy.error ? <ResultError message={policy.error.message} /> : null}
      <ResultNote>Changing a policy can invalidate schedules for the account.</ResultNote>
      {callData && (!recovery || savedSelector) ? (
        <TimelockSchedulePanel
          key={callData}
          context={{ ...context, account }}
          recovery={recovery}
          saveRecovery={saveRecovery}
          onBusyChange={onBusyChange}
          storageKey={storageKey}
          initialCallData={callData}
          initialInnerCallData={callData}
          cardWriteMode
          writeMethod="clearTimelocks"
          guidedPolicyClear
          externalBusy={disabled && !recovery}
          onExecuteSuccess={() => setInput("")}
        />
      ) : null}
      {!callData && !recovery ? <Button disabled>Start cooldown</Button> : null}
    </section>
  );
}
