"use client";

import { SymmioSupportedChainId, type SymmioSolverKind } from "@symmio/trading-core";
import { Button } from "@symmio/ui/components/button";
import { useState } from "react";

/** One selectable solver deployment: the `{chainId, solverId}` pair a hook targets. */
export interface SolverTarget {
  /** Stable option id. */
  id: string;
  /** Chain the solver lives on. */
  chainId: number;
  /** Solver id within that chain's config — which is its kind ("enigma" | "rasa"). */
  solverId: SymmioSolverKind;
  /** Display label. */
  label: string;
}

/** Every solver the app can target, across chains. */
export const SOLVER_TARGETS: readonly SolverTarget[] = [
  {
    id: "enigma",
    chainId: SymmioSupportedChainId.HYPER_EVM,
    solverId: "enigma",
    label: "Enigma · HyperEVM",
  },
  { id: "rasa", chainId: SymmioSupportedChainId.BASE, solverId: "rasa", label: "Rasa · Base" },
];

/**
 * Local state for a card's solver target. When `requireKind` is set, the
 * initial target is the first solver of that kind and other kinds render
 * disabled in {@link SolverTargetSelect}.
 */
export function useSolverTargetState(options?: { requireKind?: SymmioSolverKind }) {
  const initial = options?.requireKind
    ? (SOLVER_TARGETS.find((target) => target.solverId === options.requireKind) ?? SOLVER_TARGETS[0]!)
    : SOLVER_TARGETS[0]!;
  const [target, setTarget] = useState<SolverTarget>(initial);
  return { target, setTarget };
}

interface Props {
  value: SolverTarget;
  onChange: (target: SolverTarget) => void;
  /** When set, targets of any OTHER kind are disabled with an explanatory tooltip. */
  requireKind?: SymmioSolverKind;
  testId?: string;
}

/** Segmented per-card selector between the configured solvers (Enigma · HyperEVM / Rasa · Base). */
export function SolverTargetSelect({ value, onChange, requireKind, testId }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={testId}>
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Solver</span>
      {SOLVER_TARGETS.map((target) => {
        const unsupported = requireKind !== undefined && target.solverId !== requireKind;
        return (
          <Button
            key={target.id}
            type="button"
            size="sm"
            variant={value.id === target.id ? "default" : "outline"}
            disabled={unsupported}
            title={unsupported ? `Not supported by ${target.label} (requires a ${requireKind} solver)` : undefined}
            onClick={() => onChange(target)}
            data-testid={testId ? `${testId}-${target.id}` : undefined}
          >
            {target.label}
          </Button>
        );
      })}
    </div>
  );
}
