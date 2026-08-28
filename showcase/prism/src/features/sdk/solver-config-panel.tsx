"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { ChainPill, Pill, SolverPill } from "@/components/pill";
import { EmptyState } from "@/components/table";
import { Numeric } from "@/components/value";
import type { MarketFamily } from "@/config/deployments";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { isChanged, originOf, solverPath, type ResolvedDeployment } from "./use-resolved-config";

/**
 * Caveats the SDK's own chain registry documents in comments but cannot express
 * as data. Repeated here rather than discovered at runtime — there is no
 * config field that says "this endpoint is a stand-in" — and attributed to the
 * file they come from, because a screen that hides them would render an empty
 * table as if it were real data.
 */
const REGISTRY_CAVEATS: Partial<Record<MarketFamily, string>> = {
  majors:
    "The SDK registry marks Base's subgraphs as placeholders — Base has no subgraphs of its own yet, so subgraph-backed reads (quote history, balance history, funding) are unreliable for this deployment.",
};

/** Props for {@link SolverConfigPanel}. */
export interface SolverConfigPanelProps {
  resolved: ResolvedDeployment;
}

/**
 * One deployment's live SDK configuration, in full.
 *
 * Every value is read out of the config the `SymmioProvider` built — there is
 * no address, URL or gateway literal anywhere in this component. That is the
 * claim the panel exists to prove: an integrator writes the affiliate address
 * and the SDK answers the other twenty-odd fields.
 */
export function SolverConfigPanel({ resolved }: SolverConfigPanelProps) {
  const { deployment, chain, solver } = resolved;

  if (!chain || !solver) {
    return (
      <Panel>
        <PanelHeader
          eyebrow={deployment.label}
          title="Configuration unavailable"
          actions={<SolverPill family={deployment.family} />}
        />
        <EmptyState
          title={`${deployment.solverName} did not resolve`}
          body={
            resolved.error?.message ??
            "config.getSolver() threw for this deployment. The other deployment is unaffected."
          }
        />
      </Panel>
    );
  }

  const priceService = solver.priceService ?? chain.priceService;
  const priceServicePath = solver.priceService ? solverPath(resolved, "priceService") : "priceService";
  const notifications = solver.notifications;
  const isStaging = /stag(e|ing)/i.test(solver.url);

  return (
    <Panel>
      <PanelHeader
        eyebrow={`${deployment.label} · registered solver`}
        title={solver.name}
        actions={
          <>
            {isStaging ? (
              <Pill color="var(--warn-500)" background="var(--warn-bg)" border="var(--warn-500)">
                staging host
              </Pill>
            ) : null}
            <SolverPill family={deployment.family} />
            <ChainPill family={deployment.family} />
          </>
        }
      />

      <div className="px-4 pb-3">
        <Section label="Solver" />
        <ConfigRow resolved={resolved} label="Solver id" source="config.getSolver().id" value={solver.id} />
        <ConfigRow resolved={resolved} label="Name" path={solverPath(resolved, "name")} value={solver.name} />
        <ConfigRow
          resolved={resolved}
          label="partyB address"
          path={solverPath(resolved, "address")}
          value={solver.address}
        />
        <ConfigRow resolved={resolved} label="Base URL" path={solverPath(resolved, "url")} value={solver.url} />
        <ConfigRow
          resolved={resolved}
          label="Chain default"
          path="defaultSolverId"
          value={chain.defaultSolverId}
          hint={
            chain.defaultSolverId === solver.id
              ? "Actions that omit solverId land here."
              : "This deployment names its solver explicitly."
          }
        />
        <ConfigRow
          resolved={resolved}
          label="TP/SL handler"
          path={solverPath(resolved, "tpsl.url")}
          value={solver.tpsl?.url}
          fallback="not configured — conditional orders unsupported"
        />
        <ConfigRow
          resolved={resolved}
          label="TP/SL app name"
          path={solverPath(resolved, "tpsl.appName")}
          value={solver.tpsl?.appName}
          fallback="—"
        />
        <ConfigRow
          resolved={resolved}
          label="COH wallet"
          path={solverPath(resolved, "tpsl.cohWalletAddress")}
          value={solver.tpsl?.cohWalletAddress}
          fallback="—"
          hint={solver.tpsl ? "Must be granted the instant-trade delegation before TP/SL can fire." : undefined}
        />

        <Section label="Chain & contracts" />
        <ConfigRow
          resolved={resolved}
          label="Chain id"
          path="chainId"
          value={<Numeric size="sm">{chain.chainId}</Numeric>}
        />
        <ConfigRow
          resolved={resolved}
          label="SYMMIO core"
          path="addresses.symmioAddress"
          value={chain.addresses.symmioAddress}
          hint="The diamond every quote is sent to."
        />
        <ConfigRow
          resolved={resolved}
          label="AccountLayer"
          path="addresses.accountLayerAddress"
          value={chain.addresses.accountLayerAddress}
        />
        <ConfigRow
          resolved={resolved}
          label="InstantLayer"
          path="addresses.instantLayerAddress"
          value={chain.addresses.instantLayerAddress}
        />
        <ConfigRow
          resolved={resolved}
          label="Affiliate"
          path="addresses.affiliatesAddress"
          value={chain.addresses.affiliatesAddress}
          hint="Prism's identity on this chain. createConfig throws AFFILIATE_ADDRESS_REQUIRED without it."
        />
        <ConfigRow
          resolved={resolved}
          label="Collateral"
          path="addresses.collateralAddress"
          value={chain.addresses.collateralAddress}
        />
        <ConfigRow
          resolved={resolved}
          label="Collateral decimals"
          path="addresses.collateralDecimals"
          value={<Numeric size="sm">{chain.addresses.collateralDecimals}</Numeric>}
        />

        <Section label="Data services" />
        <ConfigRow
          resolved={resolved}
          label="Price provider"
          path={`${priceServicePath}.type`}
          value={priceService.type}
          hint={
            solver.priceService
              ? "This solver overrides the chain's price service."
              : "Inherited from the chain — solver.priceService ?? chain.priceService."
          }
        />
        <ConfigRow resolved={resolved} label="Price REST" path={`${priceServicePath}.url`} value={priceService.url} />
        <ConfigRow
          resolved={resolved}
          label="Price stream"
          path={`${priceServicePath}.wsUrl`}
          value={priceService.wsUrl}
        />
        <ConfigRow
          resolved={resolved}
          label="Notifications"
          path={solverPath(resolved, "notifications.protocol")}
          value={notifications.protocol}
          hint="Selects the subscribe frame and the parser — the consumer never branches on it."
        />
        <ConfigRow
          resolved={resolved}
          label="Notifications stream"
          path={solverPath(resolved, "notifications.url")}
          value={notifications.url}
        />
        <ConfigRow
          resolved={resolved}
          label="Notifications channel"
          path={solverPath(resolved, "notifications.channel")}
          value={notifications.protocol === "enigma" ? notifications.channel : undefined}
          fallback="none — the rasa protocol subscribes by address, not by channel"
        />
        <ConfigRow
          resolved={resolved}
          label="Notification search"
          path={solverPath(resolved, "notifications.searchUrl")}
          value={notifications.searchUrl}
          fallback="none — history comes from the solver's own position-state endpoint"
        />
        <ConfigRow
          resolved={resolved}
          label="Subgraph · analytics"
          path="subgraphs.analytics"
          value={chain.subgraphs.analytics}
        />
        <ConfigRow
          resolved={resolved}
          label="Subgraph · events"
          path="subgraphs.events"
          value={chain.subgraphs.events}
        />
        <ConfigRow
          resolved={resolved}
          label="Muon gateways"
          path="muon.urls"
          value={
            <span className="flex flex-col gap-0.5">
              {chain.muon.urls.map((url) => (
                <span key={url}>{url}</span>
              ))}
            </span>
          }
          hint="Tried in order until one returns an attestation."
        />

        {REGISTRY_CAVEATS[deployment.family] ? (
          <p className="mt-3 rounded-md border border-warn/30 bg-warn-bg px-3 py-2 text-xs leading-relaxed text-fg-1">
            <span className="font-semibold text-warn">Known limitation · </span>
            {REGISTRY_CAVEATS[deployment.family]}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

interface SectionProps {
  label: string;
}

/** Group divider inside a config card. Bottom hairline only, like every table. */
function Section({ label }: SectionProps) {
  return (
    <div className="mt-4 mb-1 flex items-center gap-3 border-b border-line pb-1.5 first:mt-2">
      <MicroLabel tone="default">{label}</MicroLabel>
    </div>
  );
}

interface ConfigRowProps {
  resolved: ResolvedDeployment;
  /** Human name of the field. */
  label: string;
  /** Dotted config path. Present for anything the config actually stores. */
  path?: string;
  /** The SDK expression behind a value the config does not store directly. */
  source?: string;
  /** The live value. `undefined` renders `fallback` in the muted tone. */
  value?: ReactNode;
  /** What to say when the field is unset — never left blank. */
  fallback?: string;
  /** One line of context, when the value alone is not self-explaining. */
  hint?: string;
}

/**
 * One config field: what it is, what the SDK resolved it to, and who put it
 * there. The provenance tag is the whole reason this row exists.
 */
function ConfigRow({ resolved, label, path, source, value, fallback, hint }: ConfigRowProps) {
  const missing = value === undefined || value === null || value === "";
  const origin = path ? originOf(resolved, path) : "derived";
  const changed = path ? isChanged(resolved, path) : false;

  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 border-b border-line-subtle py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm text-fg-2">{label}</span>
        <span className="font-mono text-2xs break-all text-fg-3">{path ?? source}</span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("font-mono text-xs break-all", missing ? "text-fg-3 italic" : "font-semibold text-fg-0")}>
          {missing ? (fallback ?? "—") : value}
        </span>
        {hint ? <span className="text-2xs leading-snug text-fg-3">{hint}</span> : null}
      </div>

      <OriginTag origin={origin} changed={changed} />
    </div>
  );
}

interface OriginTagProps {
  origin: "app" | "registry" | "derived";
  /** True when the live value actually differs from the SDK's built-in default. */
  changed: boolean;
}

/** Provenance marker. `app` is the only one that costs an integrator anything. */
function OriginTag({ origin, changed }: OriginTagProps) {
  const label = origin === "app" ? (changed ? "app · changed" : "app") : origin;

  return (
    <span
      className={cn(
        "mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-[2px]",
        "font-mono text-2xs font-semibold tracking-[0.12em] whitespace-nowrap uppercase",
        origin === "app" ? "border-accent-bd bg-accent-bg text-accent" : "border-line-subtle bg-bg-2 text-fg-3",
      )}
    >
      {label}
    </span>
  );
}
