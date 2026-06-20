"use client";

import { Field } from "@/components/field";
import { useQuote } from "@symm-frontier/react";
import { Input } from "@symm-frontier/ui/components/input";
import { LiveResult } from "./live-result";
import type { MagicMethodPanelProps } from "./magic-types";
import { magicInputPersistKey, usePersistentPinState } from "./magic-value-store";

function parseUint(value: string): bigint | undefined {
  return /^\d+$/.test(value.trim()) ? BigInt(value.trim()) : undefined;
}

/** Magic-method panel polling `getQuote(quoteId)` for a single quote. */
export function QuoteLivePanel({ intervalMs, enabled, initialInput, persistKey, seedToken }: MagicMethodPanelProps) {
  const [value, setValue] = usePersistentPinState(magicInputPersistKey(persistKey), initialInput ?? "", seedToken);
  const quoteId = parseUint(value);
  const active = enabled && quoteId !== undefined;

  const query = useQuote({
    quoteId,
    query: { enabled: active, refetchInterval: active ? intervalMs : false, refetchIntervalInBackground: true },
  });

  return (
    <div className="flex flex-col gap-3">
      <Field label="quoteId" htmlFor="magic-quote-id">
        <Input
          id="magic-quote-id"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0"
          inputMode="numeric"
          aria-invalid={value.length > 0 && quoteId === undefined}
        />
      </Field>
      <LiveResult
        query={{
          data: query.data,
          dataUpdatedAt: query.dataUpdatedAt,
          isFetching: query.isFetching,
          error: query.error,
        }}
        active={active}
        idleHint="Enter a quote id to start polling."
        persistKey={persistKey}
      />
    </div>
  );
}
