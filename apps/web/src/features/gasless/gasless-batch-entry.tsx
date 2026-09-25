"use client";

import { Field } from "@/components/field";
import { formatUsd, WEI_DECIMALS } from "@/lib/format";
import type { GaslessBatchCall } from "@symmio/trading-core";
import { GASLESS_RELAYABLE_FUNCTIONS, useGaslessBatchFeeQuote } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Textarea } from "@symmio/ui/components/textarea";
import { cn } from "@symmio/ui/lib/utils";
import { BaseError, encodeFunctionData, isAddress, type AbiFunction, type Address, type Hex } from "viem";
import { batchArgsSkeleton, parseBatchArgs } from "./gasless-batch-args";
import { parseGaslessWalletIdText } from "./wallet-id-field";

/** Calldata is `0x` plus whole bytes — a selector alone is four bytes. */
const HEX_CALLDATA = /^0x([0-9a-fA-F]{2})*$/;

/** The relayable writes a batch can carry, in the SDK's own order. */
const RELAYABLE_WRITES = [...GASLESS_RELAYABLE_FUNCTIONS.values()];

/**
 * A write's signature for the picker, one level deep: each parameter's type and
 * name, with a struct left as `tuple`. The full struct would run a line past
 * the screen for the signed-price writes, and picking the write fills the
 * arguments box with its exact shape anyway.
 */
function pickerSignature(item: AbiFunction): string {
  return `${item.name}(${item.inputs.map((input) => [input.type, input.name].filter(Boolean).join(" ")).join(", ")})`;
}

/** One batch entry as the editor holds it, before it becomes a call. */
export type BatchEntryInput =
  /** A relayable write: which function, and its arguments as JSON. */
  | { type: "write"; functionName: string; argsText: string }
  /** One call the owner's GaslessWallet makes, as raw calldata. */
  | { type: "wallet"; walletIdText: string; target: string; data: string };

/** A {@link BatchEntryInput} with the stable key its row renders under. */
export type BatchEntryDraft = BatchEntryInput & { key: number };

/** An entry resolved to the call the batch relays — or why it cannot be yet. */
export type ResolvedBatchEntry = { call: GaslessBatchCall; label: string } | { error: string };

/**
 * Turn an entry into its batch call, encoding a write's arguments up front so
 * a type mismatch is reported on the entry itself rather than as a failed
 * estimate for the whole batch.
 */
export function resolveBatchEntry(entry: BatchEntryInput): ResolvedBatchEntry {
  if (entry.type === "wallet") {
    const walletId = parseGaslessWalletIdText(entry.walletIdText);
    if (walletId === null) return { error: "Enter a wallet id." };
    if (!isAddress(entry.target)) return { error: "Enter the address the wallet calls." };
    if (!HEX_CALLDATA.test(entry.data) || entry.data.length < 10) return { error: "Enter the calldata as 0x hex." };
    return {
      call: { walletId, walletCalls: [{ target: entry.target as Address, data: entry.data as Hex }] },
      label: `wallet ${walletId.toString()} call`,
    };
  }

  const item = GASLESS_RELAYABLE_FUNCTIONS.get(entry.functionName);
  if (!item) return { error: "Pick a relayable write." };
  const parsed = parseBatchArgs(entry.argsText);
  if ("error" in parsed) return { error: parsed.error };
  try {
    encodeFunctionData({ abi: [item], functionName: item.name, args: parsed.args });
  } catch (err) {
    return { error: err instanceof BaseError ? err.shortMessage : "These arguments do not encode." };
  }
  return { call: { functionName: item.name, args: parsed.args }, label: item.name };
}

interface Props {
  index: number;
  entry: BatchEntryDraft;
  resolved: ResolvedBatchEntry;
  /** The batch's account — pre-fills a picked write's address arguments. */
  account?: Address;
  /** The whole batch, once every entry resolves; the entry shows its own row of the batch's quote. */
  batch?: { account: Address; calls: readonly GaslessBatchCall[] };
  onChange: (next: BatchEntryDraft) => void;
  onRemove: () => void;
}

/** One entry of the batch editor: its call form, its validation, and its share of the fee. */
export function GaslessBatchEntry({ index, entry, resolved, account, batch, onChange, onRemove }: Props) {
  const idPrefix = `gasless-batch-entry-${index}`;

  return (
    <div
      className="border-border/70 bg-muted/20 space-y-3 rounded-xl border p-3"
      data-testid={`${idPrefix}`}
      data-valid={"call" in resolved}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs">#{index + 1}</span>
        <Badge variant={entry.type === "wallet" ? "info" : "warning"} className="tracking-wide uppercase">
          {entry.type === "wallet" ? "wallet call" : "write"}
        </Badge>
        <span className="font-mono text-sm">{"call" in resolved ? resolved.label : "—"}</span>
        <span className="ml-auto flex items-center gap-2">
          {batch ? <EntryFee index={index} batch={batch} testId={`${idPrefix}-fee`} /> : null}
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onRemove}
            aria-label={`Remove call #${index + 1}`}
            className="text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            data-testid={`${idPrefix}-remove`}
          >
            <RemoveIcon />
            Remove
          </Button>
        </span>
      </div>

      {entry.type === "write" ? (
        <>
          <Field label="Relayable write" htmlFor={`${idPrefix}-function`}>
            <Select
              value={entry.functionName}
              onValueChange={(functionName) => {
                const item = GASLESS_RELAYABLE_FUNCTIONS.get(functionName);
                onChange({ ...entry, functionName, argsText: item ? batchArgsSkeleton(item, account) : "[]" });
              }}
            >
              <SelectTrigger id={`${idPrefix}-function`} data-testid={`${idPrefix}-function`}>
                <SelectValue placeholder="Pick a write" />
              </SelectTrigger>
              <SelectContent>
                {RELAYABLE_WRITES.map((item) => (
                  <SelectItem key={item.name} value={item.name} description={pickerSignature(item)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Arguments (JSON array)"
            htmlFor={`${idPrefix}-args`}
            hint={
              "error" in resolved
                ? resolved.error
                : 'Integers as "123n" strings — 18-decimal amounts overflow plain JSON numbers.'
            }
          >
            <Textarea
              id={`${idPrefix}-args`}
              value={entry.argsText}
              onChange={(event) => onChange({ ...entry, argsText: event.target.value })}
              rows={4}
              className="font-mono text-xs"
              aria-invalid={"error" in resolved && entry.functionName.length > 0}
              data-testid={`${idPrefix}-args`}
            />
          </Field>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <Field label="walletId" htmlFor={`${idPrefix}-wallet-id`}>
              <Input
                id={`${idPrefix}-wallet-id`}
                value={entry.walletIdText}
                onChange={(event) => onChange({ ...entry, walletIdText: event.target.value })}
                className="font-mono"
                data-testid={`${idPrefix}-wallet-id`}
              />
            </Field>
            <Field label="Target" htmlFor={`${idPrefix}-target`}>
              <Input
                id={`${idPrefix}-target`}
                value={entry.target}
                onChange={(event) => onChange({ ...entry, target: event.target.value })}
                placeholder="0x…"
                className="font-mono"
                data-testid={`${idPrefix}-target`}
              />
            </Field>
          </div>
          <Field
            label="Calldata"
            htmlFor={`${idPrefix}-data`}
            hint={"error" in resolved ? resolved.error : "Runs as the wallet contract, priced by its selector."}
          >
            <Textarea
              id={`${idPrefix}-data`}
              value={entry.data}
              onChange={(event) => onChange({ ...entry, data: event.target.value })}
              placeholder="0xa9059cbb…"
              rows={3}
              className="font-mono text-xs"
              data-testid={`${idPrefix}-data`}
            />
          </Field>
        </>
      )}
    </div>
  );
}

/** A cross — removes the entry it sits on. */
function RemoveIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** The entry's own row of the batch quote — the query is shared with the batch's fee line, so it costs no read. */
function EntryFee({
  index,
  batch,
  testId,
}: {
  index: number;
  batch: { account: Address; calls: readonly GaslessBatchCall[] };
  testId: string;
}) {
  const quote = useGaslessBatchFeeQuote({
    account: batch.account,
    calls: batch.calls,
    query: { staleTime: 15_000, placeholderData: (previous) => previous },
  });
  const payment = quote.data?.payments[index];
  if (!payment) return null;

  const fee18 =
    payment.operationalFee18 + payment.walletCreationFee18 + payment.depositFee18 + payment.nativeTopUpFee18;
  return (
    <span
      className={cn(
        "text-muted-foreground font-mono text-xs transition-opacity",
        quote.isPlaceholderData && "opacity-50",
      )}
      data-testid={testId}
    >
      ≈ {formatUsd(fee18, WEI_DECIMALS)} USDC
    </span>
  );
}
