"use client";

import { FAMILY_PALETTE } from "@/config/deployments";

/**
 * The one rule this whole screen exists to make obvious.
 *
 * Prism merges two deployments into a single surface, and the merge is honest
 * everywhere except money: equity can be added up for display, but it cannot be
 * moved across the boundary, because the two groups are different chains
 * settling against different solvers. Saying that once, plainly, under the
 * groups is worth more than any amount of clever UI.
 */
export function GroupBoundaryNote() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line-subtle bg-bg-1 px-4 py-3">
      <span aria-hidden className="mt-[5px] flex shrink-0 gap-[3px]">
        <span className="size-[7px] rounded-full" style={{ background: FAMILY_PALETTE.majors.base }} />
        <span className="size-[7px] rounded-full" style={{ background: FAMILY_PALETTE.lowcaps.base }} />
      </span>
      <p className="max-w-[84ch] text-base text-fg-2">
        Majors and lowcap accounts settle on separate systems, so funds move within a group, never across it. Each group
        also has its own margin model: Majors trades cross-margin off one allocated pool, Lowcaps isolates every market
        and side into its own Virtual Account.
      </p>
    </div>
  );
}
