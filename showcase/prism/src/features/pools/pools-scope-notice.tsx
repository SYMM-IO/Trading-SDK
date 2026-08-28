"use client";

import { Button } from "@/components/button";
import { usePrismMode } from "@/features/mode/mode-provider";
import { cn } from "@/lib/cn";
import { WarnGlyph } from "./listing-chips";
import { POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

/**
 * Says out loud that Pools is a one-deployment surface.
 *
 * Every other screen in Prism merges both deployments and the palette mode
 * narrows what is read. Pools cannot: the listing backend is resolved from the
 * **chain** config, and only HyperEVM carries one — Base has no pool catalog at
 * all. Rather than render an empty table under a majors palette, the screen
 * keeps reading the lowcaps deployment and names the boundary here.
 */
export function PoolsScopeNotice() {
  const { mode, setMode } = usePrismMode();
  const supported = usePoolsSupported();

  if (!supported) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-[var(--warn-500)]/35 bg-warn-bg px-4 py-3">
        {/* Sized up from the chip default: this band sits alone on the page at
            the larger type scale, where the standard glyph reads as a speck. */}
        <WarnGlyph className="mt-0.5 size-4 shrink-0 text-warn" />
        <div className="flex flex-col gap-0.5">
          <p className="text-md font-semibold text-fg-0">No listing backend on this chain</p>
          <p className="max-w-[92ch] text-sm text-fg-2">
            {POOLS_DEPLOYMENT.chainName} carries no <span className="font-mono">listing</span> block in the SDK&rsquo;s
            chain registry, so there is no catalog to read. Everything below stays idle rather than erroring per card.
          </p>
        </div>
      </div>
    );
  }

  if (mode !== "majors") return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-line bg-bg-1 px-4 py-3",
        "sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <p className="max-w-[92ch] text-sm text-fg-2">
        The palette is on <span className="text-fg-0">Majors</span>, but pools only exist on{" "}
        <span className="text-fg-0">
          {POOLS_DEPLOYMENT.label} · {POOLS_DEPLOYMENT.solverName} · {POOLS_DEPLOYMENT.chainName}
        </span>
        . Nothing below narrows with the mode — it is the same catalog either way.
      </p>
      <Button variant="secondary" size="sm" onClick={() => setMode("lowcaps")} className="shrink-0">
        Switch palette to Lowcaps
      </Button>
    </div>
  );
}
