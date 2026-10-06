/**
 * Search metadata for one card, on a page whose cards have no registry of their
 * own. Pure data — no components — so the command-palette index can import it
 * without pulling card UI into the header's bundle.
 *
 * `e2e/search-coverage.read.spec.ts` holds every list to its page: each card the
 * page renders must be listed, under the title it renders with.
 */
export interface SearchCardMeta {
  /** The card's `testId` — its DOM id, and the `#anchor` a search hit lands on. */
  id: string;
  /** The card's title, exactly as it renders. */
  title: string;
  /** Read or write, matching the card's own chip. */
  kind: "read" | "write";
  /** The section heading the card sits under, when the page has sections. */
  section?: string;
  /** One line on what the card does, written for a search result. */
  summary: string;
  /** SDK hooks and actions the card exercises, plus any other term worth matching. */
  keywords: readonly string[];
  /**
   * Set when the card renders only in some states — a solver kind, a connected
   * wallet — naming that gate. The coverage spec tolerates its absence.
   */
  gate?: string;
}
