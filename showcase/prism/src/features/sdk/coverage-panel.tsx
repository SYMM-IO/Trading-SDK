"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { EmptyState } from "@/components/table";
import { Numeric } from "@/components/value";
import { cn } from "@/lib/cn";
import type { SdkCoverage, SdkPackage } from "./scan-sdk-usage";

const PACKAGE_LABEL: Record<SdkPackage, string> = {
  core: "@symmio/trading-core",
  react: "@symmio/trading-react",
};

/** Props for {@link CoveragePanel}. */
export interface CoveragePanelProps {
  coverage: SdkCoverage;
}

/**
 * How much of the SDK this app actually exercises.
 *
 * The numbers are produced by a server-side scan of two things: each package's
 * own export barrel, and every `import` statement under `src`. Neither half is
 * a list someone maintains, so the tally cannot be padded and cannot go stale
 * as the app grows — which is the only version of this counter worth printing.
 */
export function CoveragePanel({ coverage }: CoveragePanelProps) {
  if (coverage.unavailable) {
    return (
      <Panel>
        <PanelHeader eyebrow="Scanned from source" title="SDK coverage" />
        <EmptyState
          title="Source scan unavailable"
          body={`The tally is computed by reading this app's source at build time, and that read failed: ${coverage.unavailable}. Nothing is shown rather than a number nobody can check.`}
        />
      </Panel>
    );
  }

  const byPackage: Record<SdkPackage, SdkCoverage["slices"]> = {
    core: coverage.slices.filter((slice) => slice.package === "core"),
    react: coverage.slices.filter((slice) => slice.package === "react"),
  };

  return (
    <Panel>
      <PanelHeader
        eyebrow="Scanned from source, not declared"
        title="SDK coverage"
        actions={<MicroLabel>build-time scan</MicroLabel>}
      />

      <div className="flex flex-wrap gap-x-10 gap-y-4 border-b border-line-subtle px-4 py-3">
        <Tally
          label="Modules touched"
          value={`${coverage.touchedSlices} / ${coverage.totalSlices}`}
          caption="SDK modules with at least one import"
        />
        <Tally
          label="Distinct symbols"
          value={coverage.usedSymbols}
          caption="hooks, actions, option factories, types"
        />
        <Tally label="App files" value={coverage.files} caption="files under src that import the SDK" />
      </div>

      <div className="grid gap-px bg-line-subtle lg:grid-cols-2">
        {(["core", "react"] as const).map((pkg) => (
          <div key={pkg} className="flex flex-col gap-2 bg-bg-1 p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-accent">{PACKAGE_LABEL[pkg]}</span>
              <MicroLabel>{`${byPackage[pkg].length} modules`}</MicroLabel>
            </div>

            <div className="flex flex-col">
              {byPackage[pkg].map((slice) => (
                <div key={slice.slice} className="flex flex-col gap-1 border-b border-line-subtle py-2 last:border-b-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs break-all text-fg-1">{slice.slice}</span>
                    <span className="tnum ml-auto shrink-0 text-2xs text-fg-3">{slice.used.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {slice.used.map((symbol) => (
                      <SymbolChip key={symbol} name={symbol} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <footer className="flex flex-col gap-1.5 border-t border-line-subtle px-4 py-3">
        <p className="max-w-[100ch] text-2xs leading-relaxed text-fg-3">
          The denominator counts modules, not symbols. Between them the two barrels publish{" "}
          <span className="tnum text-fg-2">{coverage.exportedSymbols.toLocaleString("en-US")}</span> exports, but most
          of those are the parameter and return types generated per hook — a symbol ratio would describe the type
          surface, not what the app does. Modules are the honest unit.
        </p>
        {coverage.unclassified.length > 0 ? (
          <p className="text-2xs text-warn">
            {coverage.unclassified.length} imported symbol(s) could not be attributed to a module:{" "}
            {coverage.unclassified.join(", ")}.
          </p>
        ) : null}
      </footer>
    </Panel>
  );
}

interface SymbolChipProps {
  name: string;
}

/** One imported symbol. Hooks are the accent — they are what a consumer writes most. */
function SymbolChip({ name }: SymbolChipProps) {
  const isHook = name.startsWith("use");

  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 py-[1px] font-mono text-2xs whitespace-nowrap",
        isHook ? "border-accent-bd bg-accent-bg text-accent" : "border-line-subtle bg-bg-2 text-fg-2",
      )}
    >
      {name}
    </span>
  );
}

interface TallyProps {
  label: string;
  value: string | number;
  caption: string;
}

/** One headline number. */
function Tally({ label, value, caption }: TallyProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <MicroLabel>{label}</MicroLabel>
      <Numeric size="xl" tone="strong">
        {value}
      </Numeric>
      <span className="text-2xs text-fg-3">{caption}</span>
    </div>
  );
}
