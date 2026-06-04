"use client";

import { StatusDot } from "@/components/status-dot";
import {
  buildChainOverrides,
  chainLabel,
  CONFIG_FIELDS,
  CONFIG_GROUPS,
  countChainOverrides,
  draftFromOverrides,
  fieldPath,
  sameOverrides,
  SUPPORTED_CHAIN_IDS,
  validateFieldValue,
  type ConfigDraft,
} from "@/config/symmio-config-schema";
import { STAGING_CHAIN_OVERRIDES, STAGING_PRESET } from "@/config/symmio-presets";
import { ConfigFieldRow } from "@/features/config/config-field-row";
import { useSymmioOverrides } from "@/features/config/symmio-overrides-store";
import { Button } from "@symm-frontier/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@symm-frontier/ui/components/sheet";
import { cn } from "@symm-frontier/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Right-anchored panel for inspecting and overriding the SDK's per-chain config
 * at runtime. Edits stage into a draft and apply on demand; the staging preset
 * and reset-to-default actions apply immediately. All overrides persist through
 * the {@link useSymmioOverrides} store.
 */
export function ConfigPanel({ open, onOpenChange }: Props) {
  const { overrides, setOverrides, overrideCount } = useSymmioOverrides();
  const [activeChain, setActiveChain] = useState<number>(SUPPORTED_CHAIN_IDS[0] ?? 0);
  const [draft, setDraft] = useState<ConfigDraft>(() => draftFromOverrides(overrides));

  /** Resync the editor from the applied config whenever it opens or is committed. */
  useEffect(() => {
    if (open) setDraft(draftFromOverrides(overrides));
  }, [open, overrides]);

  const pending = useMemo(() => buildChainOverrides(draft), [draft]);
  const appliedDraft = useMemo(() => draftFromOverrides(overrides), [overrides]);
  const isStaging = overrideCount > 0 && sameOverrides(overrides, STAGING_CHAIN_OVERRIDES);

  const invalidCount = useMemo(() => {
    let total = 0;
    for (const chainId of SUPPORTED_CHAIN_IDS) {
      for (const field of CONFIG_FIELDS) {
        if (validateFieldValue(field, draft[chainId]?.[fieldPath(field)] ?? "") !== null) total++;
      }
    }
    return total;
  }, [draft]);

  const changeCount = useMemo(() => {
    let total = 0;
    for (const chainId of SUPPORTED_CHAIN_IDS) {
      for (const field of CONFIG_FIELDS) {
        const a = (draft[chainId]?.[fieldPath(field)] ?? "").trim();
        const b = (appliedDraft[chainId]?.[fieldPath(field)] ?? "").trim();
        const same =
          field.kind === "address"
            ? a.toLowerCase() === b.toLowerCase()
            : field.kind === "decimals"
              ? Number(a) === Number(b)
              : a === b;
        if (!same) total++;
      }
    }
    return total;
  }, [draft, appliedDraft]);

  const isDirty = !sameOverrides(pending, overrides);
  const canApply = isDirty && invalidCount === 0;
  const canApplyStaging = !isStaging || isDirty;
  const canReset = overrideCount > 0 || isDirty;

  const updateField = (chainId: number, path: string, value: string) =>
    setDraft((prev) => ({ ...prev, [chainId]: { ...prev[chainId], [path]: value } }));

  const status = statusFor(overrideCount, isStaging);
  let rowIndex = 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[34rem]">
        <header className="border-border/70 relative shrink-0 overflow-hidden border-b px-6 pt-6 pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-28 h-44 opacity-80"
            style={{
              background:
                "radial-gradient(34rem 14rem at 78% 0%, color-mix(in oklab, var(--primary) 20%, transparent), transparent 70%)",
            }}
          />
          <div className="relative flex flex-col gap-3">
            <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] uppercase">
              <span className="text-primary">SDK</span>
              <span className="text-border">/</span>
              <span>Runtime Config</span>
            </div>
            <SheetTitle>Chain configuration</SheetTitle>
            <SheetDescription>
              Override the SDK&apos;s built-in addresses, solver, and subgraphs. Edits apply to every read and write the
              app makes.
            </SheetDescription>
            <span className="border-border/70 bg-muted/40 mt-0.5 inline-flex w-fit items-center gap-2 rounded-full border py-1 pr-3 pl-2.5 text-xs font-medium">
              <StatusDot tone={status.tone} pulse={status.pulse} />
              <span className="text-foreground">{status.label}</span>
            </span>
          </div>
        </header>

        <div className="border-border/70 flex shrink-0 flex-col gap-4 border-b px-6 py-4">
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground/70 text-[10px] font-semibold tracking-[0.18em] uppercase">
              Chain
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_CHAIN_IDS.map((chainId) => {
                const active = chainId === activeChain;
                const count = countChainOverrides(pending, chainId);
                return (
                  <button
                    key={chainId}
                    type="button"
                    onClick={() => setActiveChain(chainId)}
                    aria-pressed={active}
                    className={cn(
                      "focus-visible:ring-ring/40 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="font-medium">{chainLabel(chainId)}</span>
                    <span className="text-muted-foreground/70 font-mono text-[11px]">{chainId}</span>
                    {count > 0 ? (
                      <span className="bg-info/15 text-info rounded-full px-1.5 py-px font-mono text-[10px] font-semibold">
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setOverrides(STAGING_CHAIN_OVERRIDES)}
                disabled={!canApplyStaging}
              >
                <BeakerIcon className="size-4" />
                Use staging
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => setOverrides(undefined)}
                disabled={!canReset}
              >
                <ResetIcon className="size-4" />
                Reset to default
              </Button>
            </div>
            <p className="text-muted-foreground/70 text-[11px] leading-5">{STAGING_PRESET.description}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-7">
            {CONFIG_GROUPS.map((group) => (
              <section key={group.group} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                    {group.title}
                  </h3>
                  <span className="bg-border/60 h-px flex-1" aria-hidden />
                </div>
                <div className="flex flex-col gap-5">
                  {group.fields.map((field) => {
                    const path = fieldPath(field);
                    return (
                      <ConfigFieldRow
                        key={field.key}
                        field={field}
                        chainId={activeChain}
                        value={draft[activeChain]?.[path] ?? ""}
                        onChange={(value) => updateField(activeChain, path, value)}
                        index={rowIndex++}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <footer className="border-border/70 bg-card/80 shrink-0 border-t px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              {invalidCount > 0 ? (
                <>
                  <StatusDot tone="negative" />
                  <span className="text-destructive font-medium">
                    {invalidCount} field{invalidCount > 1 ? "s" : ""} to fix
                  </span>
                </>
              ) : isDirty ? (
                <>
                  <StatusDot tone="warning" />
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-semibold">{changeCount}</span> pending change
                    {changeCount > 1 ? "s" : ""}
                  </span>
                </>
              ) : (
                <>
                  <StatusDot tone="positive" pulse />
                  <span className="text-muted-foreground">Live · in sync</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isDirty ? (
                <Button variant="ghost" size="sm" onClick={() => setDraft(draftFromOverrides(overrides))}>
                  Discard
                </Button>
              ) : null}
              {isDirty ? (
                <Button size="sm" onClick={() => setOverrides(pending)} disabled={!canApply}>
                  Apply{changeCount > 0 ? ` ${changeCount}` : ""}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              )}
            </div>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function statusFor(
  overrideCount: number,
  isStaging: boolean,
): { tone: "neutral" | "info" | "warning"; label: string; pulse: boolean } {
  if (overrideCount === 0) return { tone: "neutral", label: "Matching SDK defaults", pulse: false };
  if (isStaging) return { tone: "warning", label: "Staging environment", pulse: true };
  return { tone: "info", label: `${overrideCount} override${overrideCount > 1 ? "s" : ""} active`, pulse: true };
}

function BeakerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9 3h6M10 3v6.5L5.2 17.3A2 2 0 0 0 6.9 20.5h10.2a2 2 0 0 0 1.7-3.2L14 9.5V3M7.5 14h9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ResetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
