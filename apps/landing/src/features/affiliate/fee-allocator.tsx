"use client";

import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Label } from "@symmio/ui/components/label";
import { cn } from "@symmio/ui/lib/utils";
import { useWatch } from "react-hook-form";
import { Field } from "./field";
import { CheckIcon, CloseIcon, PlusIcon } from "./icons";
import { BPS_SCALE, percentToBps } from "./registration-utils";
import type { RegistrationFormApi } from "./use-registration-form";

/**
 * A coral ladder for stakeholder segments — the brand hue stepped light-to-deep
 * so adjacent recipients stay legible as distinct bands. The protocol share uses
 * a neutral gray ({@link PROTOCOL_COLOR}), setting it apart from the recipients.
 */
const STAKE_COLORS = ["#f4643c", "#d94324", "#b52f18", "#8f210f"];

/** Neutral gray for the Symmio protocol share, set apart from the coral recipients. */
const PROTOCOL_COLOR = "var(--muted-foreground)";

/** Format basis points as a trimmed percent (`1250` → `12.5%`, `10000` → `100%`). */
function formatPercent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

interface AllocatorProps {
  api: RegistrationFormApi;
}

/**
 * The fee-split editor — the page's signature control. Stakeholders and the
 * Symmio protocol share are edited as percentages; a live segmented meter shows
 * the running total and only resolves to a full coral bar when the shares hit
 * exactly 100% (`1e18`), the split the contract requires. The "must total 100%"
 * error is the one cross-field rule, so it surfaces once the shares are touched
 * or the form is submitted rather than living in the yup schema.
 */
export function FeeAllocator({ api }: AllocatorProps) {
  const { control, register, formState } = api;
  const { errors, touchedFields, isSubmitted } = formState;

  const watchedStakeholders = useWatch({ control, name: "stakeholders" }) ?? [];
  const watchedSymmio = useWatch({ control, name: "symmioPercent" }) ?? "";

  const symmioBps = percentToBps(watchedSymmio) ?? 0;
  const stakeBps = watchedStakeholders.map((row) => percentToBps(row?.percent ?? "") ?? 0);
  const totalBps = stakeBps.reduce((sum, bps) => sum + bps, 0) + symmioBps;

  const complete = totalBps === BPS_SCALE;
  const over = totalBps > BPS_SCALE;
  const remaining = BPS_SCALE - totalBps;

  const segments = [
    ...api.stakeholders.fields.map((field, index) => ({
      key: field.id,
      bps: stakeBps[index] ?? 0,
      color: STAKE_COLORS[index % STAKE_COLORS.length],
    })),
    { key: "symmio", bps: symmioBps, color: PROTOCOL_COLOR },
  ];

  const sharesTouched =
    Boolean(touchedFields.symmioPercent) || (touchedFields.stakeholders ?? []).some((row) => row?.percent);
  const showTotalError = !complete && (isSubmitted || sharesTouched);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-foreground text-lg font-semibold tracking-tight">Fee allocation</h3>
          <p className="text-muted-foreground text-sm">
            Split affiliate fees between recipients and the protocol. Shares must total 100%.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-medium tabular-nums transition-colors",
            complete
              ? "border-positive/30 bg-positive/10 text-positive"
              : over
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          {complete ? <CheckIcon width={12} height={12} strokeWidth={2.5} /> : null}
          {formatPercent(totalBps)}
          {!complete && !over ? (
            <span className="text-muted-foreground/70">· {formatPercent(remaining)} left</span>
          ) : null}
          {over ? <span>· over by {formatPercent(-remaining)}</span> : null}
        </span>
      </header>

      {/* Live allocation meter — segments fill the track toward a full 100%. */}
      <div className="bg-muted/50 ring-border/60 flex h-2.5 w-full gap-px overflow-hidden rounded-full ring-1">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="h-full transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full"
            style={{ width: `${Math.min(segment.bps / 100, 100)}%`, backgroundColor: segment.color }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {api.stakeholders.fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <span
              className="mt-3 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STAKE_COLORS[index % STAKE_COLORS.length] }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <Field
                id={`stakeholder-${index}`}
                label={index === 0 ? "Recipient address" : `Recipient ${index + 1}`}
                placeholder="0x…"
                error={errors.stakeholders?.[index]?.receiver?.message}
                spellCheck={false}
                autoComplete="off"
                {...register(`stakeholders.${index}.receiver`)}
              />
            </div>
            <div className="w-28">
              <Field
                id={`stakeholder-share-${index}`}
                label="Share"
                inputMode="decimal"
                placeholder="0"
                adornment="%"
                className="text-right"
                error={errors.stakeholders?.[index]?.percent?.message}
                {...register(`stakeholders.${index}.percent`)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive mt-6"
              disabled={api.stakeholders.fields.length === 1}
              onClick={() => api.stakeholders.remove(index)}
              aria-label={`Remove recipient ${index + 1}`}
            >
              <CloseIcon />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => api.stakeholders.append({ receiver: "", percent: "" })}
        >
          <PlusIcon width={14} height={14} />
          Add recipient
        </Button>
      </div>

      {/* Protocol share — part of the same 100%, styled apart so it reads as its own line. */}
      <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-lg border border-dashed p-3">
        <span
          className="mt-0.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: PROTOCOL_COLOR }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <Label htmlFor="symmio-share" className="text-foreground text-sm font-medium">
            Symmio protocol
          </Label>
          <p className="text-muted-foreground text-xs leading-5">The share routed to the protocol treasury.</p>
        </div>
        <div className="relative w-28">
          <Input
            id="symmio-share"
            inputMode="decimal"
            placeholder="0"
            aria-invalid={errors.symmioPercent ? true : undefined}
            className="pr-9 text-right font-mono"
            {...register("symmioPercent")}
          />
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
            %
          </span>
        </div>
      </div>

      {errors.symmioPercent?.message ? (
        <p className="text-destructive text-xs">{errors.symmioPercent.message}</p>
      ) : null}
      {showTotalError ? <p className="text-destructive text-xs">Shares must add up to exactly 100%.</p> : null}
    </section>
  );
}
