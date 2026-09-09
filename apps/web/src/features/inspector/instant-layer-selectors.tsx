import { describeSelector, getSelectorScope } from "@/features/session-keys/session-key-selector-labels";
import { useSessionKeySelectors, useSupportsGaslessService } from "@symmio/trading-react";
import type { ComboboxItem } from "@symmio/ui/components/combobox";

/** How each authority group is described under a selector in the picker. */
const SCOPE_META: Readonly<Record<string, string>> = {
  trade: "trade lifecycle",
  account: "account management",
  withdraw: "withdraw — grants collateral exit",
};

/**
 * Build the selector picker's items from the SDK's chain-resolved session-key
 * set — every selector a key can hold, including the withdraw scope, so a grant
 * can be assembled without hand-typing `bytes4`.
 *
 * Selectors the SDK exports by name show that name; the rest show their raw
 * `bytes4` with their authority group as the subtitle. `apps/web` cannot label
 * them individually because the selector-to-method map is internal to
 * `@symmio/trading-core` and inventing names here would risk mislabelling
 * authority.
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
    meta: SCOPE_META[getSelectorScope(selector)] ?? selector,
    selected: normalized.includes(selector.toLowerCase()),
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
