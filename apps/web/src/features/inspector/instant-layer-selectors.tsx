import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
} from "@symmio/trading-react";
import type { ComboboxItem } from "@symmio/ui/components/combobox";
import type { Hex } from "viem";

interface InstantLayerSelectorSuggestion {
  name: string;
  selector: Hex;
}

/**
 * Function-selector suggestions surfaced by the combobox pickers. The selectors
 * come straight from `@symmio/trading-react`'s re-exports of the SDK's ABI-derived
 * constants — no hardcoded hex here.
 */
const SELECTOR_SUGGESTIONS: readonly InstantLayerSelectorSuggestion[] = [
  { name: "addMarginToNextVA", selector: ADD_MARGIN_TO_NEXT_VA_SELECTOR },
  { name: "sendQuoteWithAffiliateAndData", selector: SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR },
  { name: "requestToClosePosition", selector: REQUEST_TO_CLOSE_POSITION_SELECTOR },
] as const;

/**
 * Map the SDK's known selector suggestions to {@link ComboboxItem}s. Pass the
 * currently-entered selector tokens as `selected` to mark them in the picker;
 * matching is case-insensitive and tolerates not-yet-valid sibling tokens, so a
 * known selector stays checked even while the field is incomplete. Works for
 * both the single-selector read field and the multi-selector grant.
 */
export function toSelectorComboboxItems(selected: readonly string[]): ComboboxItem[] {
  const normalized = selected.map((value) => value.toLowerCase());
  return SELECTOR_SUGGESTIONS.map((item) => ({
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
