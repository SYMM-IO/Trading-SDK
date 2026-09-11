"use client";

import { Field } from "@/components/field";
import { calculateQuoteLeverage, useQuote } from "@symmio/trading-react";
import { Input } from "@symmio/ui/components/input";
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

  const leverage = query.data ? calculateQuoteLeverage(query.data) : undefined;

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
      {leverage !== undefined ? (
        <div className="flex items-baseline justify-between gap-3 text-sm" data-testid="magic-quote-leverage">
          <span className="text-muted-foreground text-xs tracking-wide uppercase">Leverage</span>
          <span className="text-foreground font-mono font-semibold">{`${parseFloat(Number(leverage).toFixed(2))}x`}</span>
        </div>
      ) : null}
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
