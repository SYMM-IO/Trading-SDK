import {
  describeSelector,
  describeSelectorPurpose,
  getSelectorScope,
} from "@/features/session-keys/session-key-selector-labels";
import { useSessionKeySelectors, useSupportsGaslessService } from "@symmio/trading-react";
import type { ComboboxItem } from "@symmio/ui/components/combobox";
import type { Hex } from "viem";

/**
 * Build the selector picker's items from the SDK's chain-resolved session-key
 * set — every selector a key can hold, including the withdraw scope, so a grant
 * can be assembled without hand-typing `bytes4`.
 *
 * Each row shows the contract method the selector stands for and the authority
 * it carries, so a grant can be reviewed by reading it rather than by decoding
 * hex. A selector this app cannot name falls back to its raw `bytes4`.
 *
 * Pass the currently-entered selector tokens as `selected` to mark them;
 * matching is case-insensitive and tolerates not-yet-valid sibling tokens, so a
 * known selector stays checked while the field is incomplete. Works for both
 * the single-selector read field and the multi-selector grant.
 */
export function useSelectorComboboxItems(selected: readonly string[]): ComboboxItem[] {
  /**
   * The account and withdraw scopes exist only on perps-core 0.8.6 and the SDK
   * throws for them elsewhere, so an older chain offers the trade selectors
   * alone rather than breaking the card.
   */
  const supportsAccountScope = useSupportsGaslessService();
  const selectors = useSessionKeySelectors({
    account: supportsAccountScope,
    withdraw: supportsAccountScope,
  });
  const normalized = selected.map((value) => value.toLowerCase());

  return selectors.map((selector) => ({
    id: selector,
    title: describeSelector(selector),
    meta: describeSelectorMeta(selector),
    selected: normalized.includes(selector.toLowerCase()),
  }));
}

/**
 * The subtitle under a selector in the picker: the authority group it belongs
 * to, and what holding it lets a key do. A selector this app cannot name shows
 * its group alone rather than a guess.
 */
function describeSelectorMeta(selector: Hex): string {
  const purpose = describeSelectorPurpose(selector);
  const scope = getSelectorScope(selector);
  return purpose ? `${scope} — ${purpose}` : scope;
}

/** Split a free-text selectors field into its raw, trimmed tokens. */
export function parseSelectorTokens(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatSelectorList(selectors: readonly string[]): string {
  return selectors.join(", ");
}
