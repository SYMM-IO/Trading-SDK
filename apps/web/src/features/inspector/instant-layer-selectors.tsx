import type { ComboboxItem } from "@symm-frontier/ui/components/combobox";
import type { Hex } from "viem";

export interface InstantLayerSelectorSuggestion {
  name: string;
  selector: Hex;
}

export const INSTANT_LAYER_V1_SELECTOR_SUGGESTIONS: readonly InstantLayerSelectorSuggestion[] = [
  { name: "ADD_MARGIN_TO_NEXT_VA", selector: "0xa6d66852" },
  { name: "CLOSE_QUOTE", selector: "0x501e891f" },
  { name: "SEND_QUOTE_WITH_AFFILIATE_AND_DATA", selector: "0xa7f3b34b" },
] as const;

/**
 * Map the known Instant Layer selector suggestions to {@link ComboboxItem}s.
 * Pass the currently-entered selector tokens as `selected` to mark them in the
 * picker; matching is case-insensitive and tolerates not-yet-valid sibling
 * tokens, so a known selector stays checked even while the field is incomplete.
 * Works for both the single-selector read field and the multi-selector grant.
 */
export function toSelectorComboboxItems(selected: readonly string[]): ComboboxItem[] {
  const normalized = selected.map((value) => value.toLowerCase());
  return INSTANT_LAYER_V1_SELECTOR_SUGGESTIONS.map((item) => ({
    id: item.selector,
    title: item.name,
    meta: item.selector,
    selected: normalized.includes(item.selector.toLowerCase()),
  }));
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
