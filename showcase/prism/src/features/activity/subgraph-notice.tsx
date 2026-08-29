"use client";

import { SolverPill } from "@/components/pill";
import type { Deployment, MarketFamily } from "@/config/deployments";
import { cn } from "@/lib/cn";
import { getChainConfig } from "@symmio/trading-core";
import type { ReactNode } from "react";
import type { DeploymentReadState } from "./activity-types";

/**
 * Deployments whose subgraph endpoints are placeholders in the SDK's chain
 * registry rather than real indexers.
 *
 * Every family now ships its own real analytics + events subgraphs — Base's
 * `base_analytics` / `base_events` are live production endpoints — so this set is
 * empty and every subgraph-backed read runs for real. Add a family back only if a
 * deployment is ever configured with a stand-in endpoint again.
 */
const PLACEHOLDER_SUBGRAPH_FAMILIES: ReadonlySet<MarketFamily> = new Set<MarketFamily>();

/** Which subgraph a read hits, so the notice can name the exact endpoint. */
export type SubgraphKind = "analytics" | "events";

/** True when this deployment's subgraphs are registry placeholders, not real indexers. */
export function hasPlaceholderSubgraph(deployment: Deployment): boolean {
  return PLACEHOLDER_SUBGRAPH_FAMILIES.has(deployment.family);
}

/** The endpoint a subgraph-backed read will actually call for this deployment. */
export function subgraphUrl(deployment: Deployment, kind: SubgraphKind): string {
  return getChainConfig(deployment.chainId).subgraphs[kind];
}

export interface DeploymentNoticeProps {
  deployment: Deployment;
  /** `warn` for a known-unreliable source, `error` for a read that actually failed. */
  tone: "warn" | "error";
  title: string;
  children: ReactNode;
  /** Endpoint or other verbatim detail, rendered monospace under the body. */
  detail?: string;
}

/**
 * An inline band naming one deployment and why its rows are missing.
 *
 * Deliberately not an `EmptyState`: an empty table and a broken read look
 * identical to a reader, and in a merged two-solver view that ambiguity is a
 * lie. Provenance is the product here, so the failure gets a row of its own.
 */
export function DeploymentNotice({ deployment, tone, title, children, detail }: DeploymentNoticeProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-line-subtle px-4 py-3",
        tone === "error" ? "bg-short-bg" : "bg-warn-bg",
      )}
    >
      <NoticeIcon tone={tone} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <SolverPill family={deployment.family} />
          <span className={cn("text-sm font-semibold", tone === "error" ? "text-short" : "text-warn")}>{title}</span>
        </div>
        <p className="max-w-[86ch] text-sm text-fg-2">{children}</p>
        {detail ? <p className="tnum max-w-full truncate text-2xs text-fg-3">{detail}</p> : null}
      </div>
    </div>
  );
}

export interface DeploymentNoticesProps {
  /** One entry per deployment the merged table claims to cover. */
  states: readonly DeploymentReadState[];
  /** Which subgraph these reads hit — named in the placeholder notice. */
  source: SubgraphKind;
  /** What the reads were called, e.g. "quote history". */
  label: string;
}

/**
 * Render a notice for every deployment that failed or is known-unreliable.
 *
 * A deployment that answered normally contributes nothing, so a healthy merged
 * view stays clean; one solver being down never blanks the other's rows, it
 * just adds a band above them.
 */
export function DeploymentNotices({ states, source, label }: DeploymentNoticesProps) {
  return (
    <>
      {states.map((state) => {
        if (state.error) {
          return (
            <DeploymentNotice
              key={`${state.deployment.family}:error`}
              deployment={state.deployment}
              tone="error"
              title={`${state.deployment.label} ${label} failed`}
              detail={subgraphUrl(state.deployment, source)}
            >
              {state.error.message}
            </DeploymentNotice>
          );
        }

        if (state.attempted && hasPlaceholderSubgraph(state.deployment)) {
          return (
            <DeploymentNotice
              key={`${state.deployment.family}:placeholder`}
              deployment={state.deployment}
              tone="warn"
              title={`${state.deployment.chainName} ${source} subgraph is a placeholder`}
              detail={subgraphUrl(state.deployment, source)}
            >
              {`The SDK chain registry ships this endpoint as a stand-in — ${state.deployment.chainName} has no indexer of its own yet. Whatever it returns is not ${state.deployment.label} ${label}, and the ${state.rowCount === 0 ? "empty result below means “not indexed”, not “no activity”" : "rows below cannot be trusted as this deployment's history"}.`}
            </DeploymentNotice>
          );
        }

        return null;
      })}
    </>
  );
}

interface IconProps {
  tone: "warn" | "error";
}

/** Alert glyph. Inline SVG — Prism ships no icon library. */
function NoticeIcon({ tone }: IconProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn("mt-[3px] size-4 shrink-0", tone === "error" ? "text-short" : "text-warn")}
    >
      <path d="M8 1.6 15 14H1L8 1.6Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 6v3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
    </svg>
  );
}
