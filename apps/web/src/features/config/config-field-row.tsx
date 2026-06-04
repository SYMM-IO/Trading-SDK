"use client";

import { Field } from "@/components/field";
import {
  defaultFieldValue,
  isFieldOverridden,
  validateFieldValue,
  type ConfigFieldDef,
} from "@/config/symmio-config-schema";
import { CopyButton } from "@symm-frontier/ui/components/copy-button";
import { Input } from "@symm-frontier/ui/components/input";
import { cn } from "@symm-frontier/ui/lib/utils";
import { shortenAddress } from "@symm-frontier/utils";
import type { CSSProperties } from "react";
import type { Address } from "viem";

interface Props {
  field: ConfigFieldDef;
  chainId: number;
  value: string;
  onChange: (value: string) => void;
  /** Stagger index for the entrance animation. */
  index: number;
}

function shortDisplay(field: ConfigFieldDef, value: string): string {
  if (field.kind === "address") return shortenAddress(value as Address, { chars: 6 });
  return value;
}

/**
 * One editable field of a chain config: an input that surfaces whether it
 * diverges from the SDK default, with a reset affordance and the default value
 * for reference.
 */
export function ConfigFieldRow({ field, chainId, value, onChange, index }: Props) {
  const id = `cfg-${chainId}-${field.group}-${field.key}`;
  const error = validateFieldValue(field, value);
  const overridden = isFieldOverridden(field, value, chainId);
  const def = defaultFieldValue(chainId, field);
  const mono = field.kind !== "text";

  return (
    <Field
      className="animate-enter-up"
      style={{ "--enter-delay": `${index * 36}ms` } as CSSProperties}
      htmlFor={id}
      label={
        <span className="flex items-center gap-2">
          <span>{field.label}</span>
          {field.hint ? (
            <span className="text-muted-foreground/60 font-mono text-[10px] tracking-wide">{field.hint}</span>
          ) : null}
          {overridden ? (
            <span className="bg-info shadow-info/40 size-1.5 shrink-0 rounded-full shadow-[0_0_0_3px]" aria-hidden />
          ) : null}
        </span>
      }
      action={
        overridden && !error ? (
          <button
            type="button"
            onClick={() => onChange(def)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 -mr-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2"
          >
            <ResetIcon className="size-3" />
            Reset
          </button>
        ) : null
      }
      hint={
        error ? (
          <span className="text-destructive font-medium">{error}</span>
        ) : overridden ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-muted-foreground/60 shrink-0 text-[11px] tracking-wide uppercase">Default</span>
            <span className="text-muted-foreground/90 truncate font-mono text-[11px]">{shortDisplay(field, def)}</span>
            <CopyButton value={def} className="size-4 shrink-0" />
          </span>
        ) : null
      }
    >
      <Input
        id={id}
        value={value}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        inputMode={field.kind === "decimals" ? "numeric" : undefined}
        aria-invalid={error ? true : undefined}
        placeholder={def}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-10",
          mono && "font-mono text-[13px]",
          overridden && !error && "border-info/45 bg-info/4 focus-visible:border-info",
        )}
      />
    </Field>
  );
}

function ResetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
