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
  /**
   * Stable key (the pin's `methodId`) the panel persists its displayed value(s)
   * under, so a page reload restores them instead of blanking until the next
   * poll. Omitted when the panel is rendered outside the pinned board.
   */
  persistKey?: string;
  /**
   * Monotonic "re-seed" signal. When it changes, the panel re-adopts
   * {@link MagicMethodPanelProps.initialInput}, overriding whatever the user (or
   * a previous prefill) had set — even on an already-mounted card. Lets a trigger
   * such as "watch this sub-account" retarget a pinned card to a new address.
   * Omitted (and ignored) when the card was never prefilled from outside.
   */
  seedToken?: number;
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
  /**
   * Cap (px) for the pinned card's body before it starts scrolling inside the
   * card. The body grows with its content up to this height; past it, the card
   * scrolls instead of pushing the rest of the board down. Tune it per method —
   * a streaming log wants more room than a single quote. Omit to use the shared
   * default. The user can still drag the card's bottom edge past it.
   */
  bodyMaxHeight?: number;
  /** Panel that owns the method's inputs, live source, and response history. */
  Panel: ComponentType<MagicMethodPanelProps>;
}
