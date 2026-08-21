"use client";

import { Segmented } from "@/components/segmented";
import type { PrismMode } from "@/config/deployments";
import { usePrismMode } from "@/features/mode/mode-provider";

const OPTIONS = [
  { value: "unified" as const, label: "Unified", swatches: ["#BD93F9", "#8BE9FD"] as const },
  { value: "majors" as const, label: "Majors", swatches: ["#8BE9FD", "#F1FA8C"] as const },
  { value: "lowcaps" as const, label: "Lowcaps", swatches: ["#FF79C6", "#FFB86C"] as const },
];

/**
 * The global mode switch.
 *
 * Changes the palette and narrows which deployments the data hooks read from.
 * It never changes layout, density or radius — the design system forbids it.
 */
export function ModeSwitch() {
  const { mode, setMode } = usePrismMode();

  return <Segmented<PrismMode> options={OPTIONS} value={mode} onChange={setMode} size="sm" />;
}
