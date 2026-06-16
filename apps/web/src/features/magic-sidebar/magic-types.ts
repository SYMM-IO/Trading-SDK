import type { ComponentType } from "react";

/**
 * Transport a magic method's data comes from. `socket` is reserved for live WS
 * feeds; `hybrid` is a polled source whose cadence is accelerated by a socket.
 */
export type MagicSource = "poll" | "socket" | "hybrid";

/** Catalog grouping for the method browser. */
export type MagicGroup = "solver" | "onchain" | "socket";

/** Human labels for each {@link MagicGroup}. */
export const MAGIC_GROUP_LABELS: Record<MagicGroup, string> = {
  solver: "Solver reads",
  onchain: "On-chain reads",
  socket: "Live sockets",
};

/** Order the groups render in the catalog. */
export const MAGIC_GROUP_ORDER: MagicGroup[] = ["solver", "onchain", "socket"];

/** Props every magic-method panel receives from its pinned card. */
export interface MagicMethodPanelProps {
  /** Poll cadence in milliseconds. */
  intervalMs: number;
  /** Whether the source should be active (card expanded and sidebar open). */
  enabled: boolean;
  /**
   * Initial input value to seed the panel with (the input the source card was
   * showing when pinned). Lets the live card inherit the card's data via the
   * shared query cache instead of starting blank.
   */
  initialInput?: string;
}

/**
 * A method that can be pinned to the magic sidebar for live monitoring. Add a new
 * entry to `MAGIC_CATALOG` to make a method browsable and pinnable; a matching
 * `magicMethodId` on the method's read card surfaces the inline pin button.
 */
export interface MagicMethod {
  /** Stable id — matches the read card's `magicMethodId`. */
  id: string;
  /** Short label shown in the catalog and on the pinned card. */
  label: string;
  /** One-line description shown in the catalog. */
  description: string;
  /** Catalog group. */
  group: MagicGroup;
  /** Data transport (drives the source badge; `socket` is reserved for WS feeds). */
  source: MagicSource;
  /** Extra search terms beyond label/description. */
  keywords: string[];
  /** Panel that owns the method's inputs, live source, and response history. */
  Panel: ComponentType<MagicMethodPanelProps>;
}
