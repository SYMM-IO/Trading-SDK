"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { SolverPill } from "@/components/pill";
import { DataRow, DataTable } from "@/components/table";
import { DEPLOYMENTS, type Deployment } from "@/config/deployments";
import { useSolverCapabilities, useSymmioConfig } from "@symmio/trading-react";
import type { ReactNode } from "react";
import { CAPABILITY_ROWS, type CapabilityCell, type CapabilityRow } from "./capabilities";

/** One label column wide enough for the longest question, then one column per deployment. */
const COLUMNS = `minmax(280px, 1.7fr) repeat(${DEPLOYMENTS.length}, minmax(150px, 1fr))`;

/**
 * What each solver can do, asked rather than asserted.
 *
 * Every cell calls the SDK's own gate for its deployment — `useSolverCapabilities`,
 * `supportsEstimatedPrice`, or the resolved solver kind — so the table is a
 * recording of the SDK answering, not a table someone typed. Gating on these is
 * also the supported way to build a multi-solver UI: a kind-exclusive endpoint
 * throws `UNSUPPORTED_BY_SOLVER`, and asking first is cheaper than catching.
 */
export function CapabilityMatrix() {
  return (
    <Panel>
      <PanelHeader
        eyebrow="Runtime capability probe"
        title="What each solver supports"
        actions={<MicroLabel>{`${CAPABILITY_ROWS.length} gates × ${DEPLOYMENTS.length} deployments`}</MicroLabel>}
      />

      <DataTable
        columns={COLUMNS}
        head={
          <>
            <MicroLabel>Capability · SDK gate</MicroLabel>
            {DEPLOYMENTS.map((deployment) => (
              <div key={deployment.family} className="flex items-center gap-2">
                <SolverPill family={deployment.family} variant="name" />
                <span className="text-2xs text-fg-3">{deployment.chainName}</span>
              </div>
            ))}
          </>
        }
      >
        {CAPABILITY_ROWS.map((row) => (
          <DataRow key={row.id} columns={COLUMNS} className="items-start">
            <div className="flex min-w-0 flex-col gap-1 py-0.5">
              <span className="text-md font-semibold text-fg-0">{row.label}</span>
              <span className="font-mono text-2xs break-all text-accent/80">{row.source}</span>
              <span className="max-w-[62ch] text-2xs leading-snug text-fg-3">{row.note}</span>
            </div>

            {DEPLOYMENTS.map((deployment) => (
              <CapabilityAnswer key={deployment.family} row={row} deployment={deployment} />
            ))}
          </DataRow>
        ))}
      </DataTable>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-subtle px-4 py-2.5">
        <Legend tone="yes" icon={<YesIcon />} text="Supported — the SDK gate returns true" />
        <Legend tone="no" icon={<NoIcon />} text="Unsupported — calling it throws UNSUPPORTED_BY_SOLVER" />
      </footer>
    </Panel>
  );
}

interface AnswerProps {
  row: CapabilityRow;
  deployment: Deployment;
}

/**
 * One cell.
 *
 * A component per cell so `useSolverCapabilities` can be called with this
 * deployment's `{ chainId, solverId }` — a hook cannot be called in a loop, and
 * the answer for Base must not be reused for HyperEVM. The hook resolves
 * synchronously from config, so a cell costs a context read, not a request.
 */
function CapabilityAnswer({ row, deployment }: AnswerProps) {
  const config = useSymmioConfig();
  const capabilities = useSolverCapabilities({
    chainId: deployment.chainId,
    solverId: deployment.solverId,
  });

  let cell: CapabilityCell;
  try {
    cell = row.resolve({
      config,
      chainId: deployment.chainId,
      solverId: config.getSolver({ chainId: deployment.chainId, solverId: deployment.solverId }).id,
      capabilities,
    });
  } catch {
    /* An unresolvable solver is an answer too — never blank the other column. */
    cell = { kind: "no", detail: "solver did not resolve" };
  }

  return (
    <div className="flex min-w-0 flex-col gap-1 py-0.5">
      {cell.kind === "value" ? (
        <span className="tnum text-md font-semibold text-fg-0">{cell.label}</span>
      ) : (
        <span className={cell.kind === "yes" ? "text-long" : "text-fg-3"}>
          {cell.kind === "yes" ? <YesIcon /> : <NoIcon />}
        </span>
      )}
      {cell.detail ? <span className="text-2xs leading-snug text-fg-3">{cell.detail}</span> : null}
    </div>
  );
}

interface LegendProps {
  tone: "yes" | "no";
  icon: ReactNode;
  text: string;
}

/** One legend entry. The icons carry the meaning; the text spells it out once. */
function Legend({ tone, icon, text }: LegendProps) {
  return (
    <span className="flex items-center gap-2 text-2xs text-fg-3">
      <span className={tone === "yes" ? "text-long" : "text-fg-3"}>{icon}</span>
      {text}
    </span>
  );
}

function YesIcon() {
  return (
    <svg
      aria-label="supported"
      role="img"
      viewBox="0 0 14 14"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.6 7.4 5.6 10.4l5.8-6.6" />
    </svg>
  );
}

function NoIcon() {
  return (
    <svg
      aria-label="unsupported"
      role="img"
      viewBox="0 0 14 14"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M3 7h8" />
    </svg>
  );
}
