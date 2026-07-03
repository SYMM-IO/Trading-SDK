"use client";

import { Field } from "@/components/field";
import { formatUsd } from "@/lib/format";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Collateral token decimals, for the optional Max button. */
  decimals: number;
  /** Available balance (collateral units) backing the Max button + hint. */
  max?: bigint;
  /** Label for the Max source, e.g. "wallet" or "withdrawable". */
  maxLabel?: string;
  invalid?: boolean;
  testId?: string;
}

/**
 * Token-aware amount input: a decimal field with a "Max" action that fills the
 * available balance (formatted with the collateral decimals) and a hint showing
 * that balance. Shared by the deposit and withdraw flows.
 */
export function AmountField({
  id,
  label,
  value,
  onChange,
  decimals,
  max,
  maxLabel = "available",
  invalid,
  testId,
}: Props) {
  const formattedMax = max !== undefined ? formatUsd(max, decimals) : undefined;

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={formattedMax ? `${formattedMax} ${maxLabel}` : undefined}
      action={
        max !== undefined && max > 0n ? (
          <Button type="button" size="xs" variant="ghost" onClick={() => onChange(formatUsd(max, decimals))}>
            Max
          </Button>
        ) : undefined
      }
    >
      <div className="relative">
        <Input
          id={id}
          data-testid={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          aria-invalid={invalid}
          className="pr-16 font-mono text-base tabular-nums"
        />
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium tracking-wide">
          USDC
        </span>
      </div>
    </Field>
  );
}
