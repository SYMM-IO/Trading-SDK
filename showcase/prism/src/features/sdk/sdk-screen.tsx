"use client";

import { MicroLabel, Panel } from "@/components/panel";
import { Numeric, Stat } from "@/components/value";
import { CapabilityMatrix } from "./capability-matrix";
import { CoveragePanel } from "./coverage-panel";
import { DerivedPanel } from "./derived-panel";
import { FanOutPanel } from "./fan-out-panel";
import { HealthStrip } from "./health-strip";
import { IntegrationPanel } from "./integration-panel";
import type { SdkCoverage } from "./scan-sdk-usage";
import { SolverConfigPanel } from "./solver-config-panel";
import { useResolvedDeployments, type ResolvedDeployment } from "./use-resolved-config";

/** Props for {@link SdkScreen}. */
export interface SdkScreenProps {
  /** Import tally, scanned on the server and handed down. */
  coverage: SdkCoverage;
}

/**
 * The developer-facing view of Prism.
 *
 * Deliberately accent-only chrome: this screen is the platform talking about
 * itself, so the cyan and magenta belong strictly to the two deployments'
 * own pills and stripes. Everything else — every number, rule and marker — is
 * the app accent, which is what re-tints when the palette mode changes.
 */
export function SdkScreen({ coverage }: SdkScreenProps) {
  const resolved = useResolvedDeployments();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-6">
      <Hero resolved={resolved} />

      <HealthStrip resolved={resolved} />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* Sticky on wide screens: the wiring stays in view while the list of
            things nobody wired scrolls past it. That pairing is the argument. */}
        <div className="xl:sticky xl:top-4">
          <IntegrationPanel />
        </div>
        <DerivedPanel resolved={resolved} />
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Registered solvers"
          body="Every field below was read out of the config the SymmioProvider built at runtime. There is not one address, URL or gateway literal in this screen's source."
        />
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {resolved.map((entry) => (
            <SolverConfigPanel key={entry.deployment.family} resolved={entry} />
          ))}
        </div>
      </section>

      <CapabilityMatrix />
      <FanOutPanel />
      <CoveragePanel coverage={coverage} />
    </div>
  );
}

interface HeroProps {
  resolved: readonly ResolvedDeployment[];
}

/** The claim, and the four numbers that back it. */
function Hero({ resolved }: HeroProps) {
  const chains = new Set(resolved.map((entry) => entry.deployment.chainId));
  const kinds = new Set(resolved.map((entry) => entry.solver?.id ?? entry.deployment.solverId));
  const supplied = resolved.reduce((total, entry) => total + entry.supplied.size, 0);
  const answered = resolved.reduce((total, entry) => total + entry.fields.size, 0);

  return (
    <Panel>
      <div className="flex flex-col gap-4 px-5 py-6">
        <MicroLabel tone="accent">SYMMIO SDK · multi-solver integration</MicroLabel>

        <h1 className="max-w-[22ch] font-display text-4xl leading-[1.05] font-bold tracking-[-0.02em] text-fg-0">
          Two solvers, one order book.
        </h1>

        <p className="max-w-[86ch] text-md leading-relaxed text-fg-2">
          Prism merges two independent SYMMIO deployments — a cross-margin majors solver on Base and a Virtual-Account
          lowcap solver on HyperEVM — into a single book, a single ticket and a single blotter. They run different
          contracts, different price feeds, different notification protocols and different trade mechanics. The app does
          not branch on any of it. This page shows exactly how much of that the SDK is doing, with the live values
          beside every claim.
        </p>
      </div>

      <div className="grid gap-x-8 gap-y-4 border-t border-line-subtle px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Deployments merged"
          value={
            <Numeric size="xl" tone="accent">
              {resolved.length}
            </Numeric>
          }
          sub="one (chainId, solverId) pair each"
        />
        <Stat
          label="Chains read at once"
          value={
            <Numeric size="xl" tone="strong">
              {chains.size}
            </Numeric>
          }
          sub="no wallet switching for reads"
        />
        <Stat
          label="Solver kinds"
          value={
            <Numeric size="xl" tone="strong">
              {kinds.size}
            </Numeric>
          }
          sub="separate REST schemas and clients"
        />
        <Stat
          label="Config Prism wrote"
          value={
            <span className="flex items-baseline gap-1.5">
              <Numeric size="xl" tone="accent">
                {supplied}
              </Numeric>
              <span className="text-sm text-fg-3">of</span>
              <Numeric size="md" tone="muted">
                {answered}
              </Numeric>
            </span>
          }
          sub="values supplied vs. values resolved"
        />
      </div>
    </Panel>
  );
}

interface SectionHeadingProps {
  title: string;
  body: string;
}

/** Section lead-in for groups of panels that share one argument. */
function SectionHeading({ title, body }: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-1 px-1">
      <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-fg-0">{title}</h2>
      <p className="max-w-[92ch] text-sm leading-relaxed text-fg-3">{body}</p>
    </div>
  );
}
