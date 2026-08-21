"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { ChainPill, SolverPill } from "@/components/pill";
import { Skeleton } from "@/components/table";
import type { Deployment } from "@/config/deployments";
import { useFundingAccounts } from "@/features/accounts/account-provider";
import { useFeedStatus, usePrismPrices, useTickSignal } from "@/features/prices/price-provider";
import { cn } from "@/lib/cn";
import { shortenAddress } from "@/lib/format";
import type { SocketStatus } from "@symmio/trading-core";
import { useMarkets, useNotifications, useSolverReadiness } from "@symmio/trading-react";
import type { ResolvedDeployment } from "./use-resolved-config";

/** How a health row is doing. Connection health is platform state, so it wears the accent. */
type HealthTone = "live" | "waking" | "idle" | "down";

const TONE_CLASS: Record<HealthTone, string> = {
  live: "text-accent",
  waking: "text-warn",
  idle: "text-fg-3",
  down: "text-short",
};

/** Map the SDK's socket status onto the four tones the strip shows. */
function toneOfSocket(status: SocketStatus): HealthTone {
  if (status === "open") return "live";
  if (status === "connecting" || status === "reconnecting") return "waking";
  return "idle";
}

/** Props for {@link HealthStrip}. */
export interface HealthStripProps {
  resolved: readonly ResolvedDeployment[];
}

/**
 * Live transport health, per deployment.
 *
 * Two sockets and one REST root per solver, reported separately because they
 * fail separately: Binance can be streaming while the Rasa REST host is down,
 * and a notification socket stays closed until there is a sub-account to watch.
 * Reporting one merged "status" would hide exactly the failure a reader wants
 * to see.
 */
export function HealthStrip({ resolved }: HealthStripProps) {
  return (
    <Panel>
      <PanelHeader
        eyebrow="Live, right now"
        title="Transport health"
        actions={<MicroLabel>one card per deployment</MicroLabel>}
      />
      <div className="grid gap-px bg-line-subtle sm:grid-cols-2">
        {resolved.map((entry) => (
          <DeploymentHealth key={entry.deployment.family} resolved={entry} />
        ))}
      </div>
    </Panel>
  );
}

interface DeploymentHealthProps {
  resolved: ResolvedDeployment;
}

/**
 * One deployment's health.
 *
 * A component per deployment because every probe here is a hook bound to a
 * single `{ chainId, solverId }` — the same shape the price provider uses for
 * its subscriptions. Adding a third deployment adds a card, not a code path.
 */
function DeploymentHealth({ resolved }: DeploymentHealthProps) {
  const { deployment, solver, chain } = resolved;
  const { streamingCountOf } = usePrismPrices();
  const { selected } = useFundingAccounts();

  /* A health card that never updates is worse than no health card: subscribe
     to the socket status, and take the throttled tick signal so the streaming
     count advances as markets arrive. `streamingCountOf` alone is a stable
     accessor and would freeze on its first read. */
  const priceStatus = useFeedStatus(deployment.family);
  useTickSignal(1000);

  const account = selected[deployment.family]?.address;
  const streaming = streamingCountOf(deployment.family);
  const priceProvider = solver?.priceService?.type ?? chain?.priceService.type;

  const notifications = useNotifications({
    account,
    chainId: deployment.chainId,
    solverId: deployment.solverId,
  });

  const markets = useMarkets({ chainId: deployment.chainId, solverId: deployment.solverId });

  return (
    <div className="flex flex-col gap-3 bg-bg-1 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SolverPill family={deployment.family} variant="name" />
        <ChainPill family={deployment.family} />
      </div>

      <div className="flex flex-col">
        <HealthRow
          label="Price stream"
          tone={toneOfSocket(priceStatus)}
          value={priceStatus}
          detail={
            streaming > 0
              ? `${streaming} markets streaming via ${priceProvider ?? "unknown provider"}`
              : `no ticks yet · ${priceProvider ?? "unknown provider"}`
          }
          source="useFeedStatus(family)"
        />

        <HealthRow
          label="Notifications"
          tone={account ? toneOfSocket(notifications.status) : "idle"}
          value={account ? notifications.status : "idle"}
          detail={
            account
              ? `${solver?.notifications.protocol ?? "?"} protocol · watching ${shortenAddress(account)}`
              : "no sub-account exists on this deployment yet — the stream subscribes to an address, so it stays closed"
          }
          source="useNotifications({ account, chainId, solverId }).status"
          error={notifications.error?.message}
        />

        <HealthRow
          label="Solver API"
          tone={markets.isError ? "down" : markets.data ? "live" : "waking"}
          value={markets.isError ? "unreachable" : markets.data ? "reachable" : "checking"}
          detail={
            markets.data
              ? `${markets.data.length} contract symbols from ${solver?.url ?? "the solver"}`
              : `GET /contract-symbols on ${solver?.url ?? "the solver"}`
          }
          source="useMarkets({ chainId, solverId })"
          error={markets.error?.message}
          pending={markets.isLoading}
        />

        {solver?.id === "rasa" ? <RasaReadiness deployment={deployment} /> : null}
      </div>
    </div>
  );
}

interface RasaReadinessProps {
  deployment: Deployment;
}

/**
 * The Rasa-only `/readyz` probe.
 *
 * Rendered as its own component so the hook is never mounted for Enigma:
 * `getSolverReadiness` throws `UNSUPPORTED_BY_SOLVER` on a non-Rasa solver, and
 * the supported way to avoid that is to not call it — not to call it and catch.
 */
function RasaReadiness({ deployment }: RasaReadinessProps) {
  const readiness = useSolverReadiness({ chainId: deployment.chainId, solverId: deployment.solverId });

  return (
    <HealthRow
      label="Readiness"
      tone={readiness.isError ? "down" : readiness.data?.isReady ? "live" : readiness.data ? "waking" : "idle"}
      value={
        readiness.isError
          ? "unavailable"
          : readiness.data
            ? readiness.data.isReady
              ? "ready"
              : "not ready"
            : "checking"
      }
      detail="GET /readyz — a Rasa-only endpoint, gated on the resolved solver kind"
      source="useSolverReadiness({ chainId, solverId })"
      error={readiness.error?.message}
      pending={readiness.isLoading}
    />
  );
}

interface HealthRowProps {
  label: string;
  tone: HealthTone;
  /** Short status word, in mono. */
  value: string;
  /** What the status is describing. */
  detail: string;
  /** The SDK expression this row reads. */
  source: string;
  /** Transport error, when there is one. Shown rather than swallowed. */
  error?: string;
  pending?: boolean;
}

/** One probe. Dot, status word, and the call that produced it. */
function HealthRow({ label, tone, value, detail, source, error, pending }: HealthRowProps) {
  return (
    <div className="flex items-start gap-3 border-b border-line-subtle py-2.5 last:border-b-0">
      <span className={cn("mt-[5px] flex shrink-0", TONE_CLASS[tone])}>
        <span aria-hidden className={cn("size-2 rounded-full bg-current", tone === "live" ? "prism-pulse" : null)} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-fg-1">{label}</span>
          {pending ? (
            <Skeleton className="h-2.5 w-16" />
          ) : (
            <span className={cn("font-mono text-2xs font-semibold tracking-[0.12em] uppercase", TONE_CLASS[tone])}>
              {value}
            </span>
          )}
        </div>
        <span className="text-2xs leading-snug break-words text-fg-3">{detail}</span>
        {error ? <span className="text-2xs leading-snug break-words text-short">{error}</span> : null}
        <span className="font-mono text-2xs break-all text-fg-3/80">{source}</span>
      </div>
    </div>
  );
}
