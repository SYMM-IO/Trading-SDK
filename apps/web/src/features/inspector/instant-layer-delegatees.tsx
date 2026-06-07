import type { ComboboxItem } from "@symm-frontier/ui/components/combobox";
import { shortenAddress } from "@symm-frontier/utils";
import type { Address } from "viem";

export interface InstantLayerDelegateeSuggestion {
  name: string;
  address?: Address;
  description: string;
}

export const COH_WALLET_MAINNET_ADDRESS = "0xf2afbb3f13Ca72bfb69749f3bC5EbD6528b1fc31" as const;
export const COH_WALLET_STAGING_ADDRESS = "0x2471c82ffe24462720d99014e6ec800548B9b1d6" as const;

export function getInstantLayerDelegateeSuggestions(solver: {
  name: string;
  address: Address;
}): readonly InstantLayerDelegateeSuggestion[] {
  return [
    {
      name: `${solver.name} PartyB`,
      address: solver.address,
      description: "Vibe v1 delegates to the solver or PartyB address for delegated execution.",
    },
    {
      name: "COH wallet",
      address: COH_WALLET_MAINNET_ADDRESS,
      description: "Conditional Order Handler wallet used by Vibe TP/SL delegation.",
    },
    {
      name: "Session key",
      description: "Vibe v2 delegates to the browser session-key address. Paste it manually if needed.",
    },
  ];
}

/**
 * Map delegatee suggestions to {@link ComboboxItem}s for the delegate field's
 * picker. Suggestions without an address (e.g. the session key) are disabled —
 * they have no value to fill, only guidance to paste one manually.
 */
export function toDelegateeComboboxItems(
  suggestions: readonly InstantLayerDelegateeSuggestion[],
  selected?: Address,
): ComboboxItem[] {
  return suggestions.map((item) => ({
    id: item.address ?? `manual:${item.name}`,
    title: item.name,
    description: item.description,
    meta: item.address ? shortenAddress(item.address) : "Paste manually",
    selected: Boolean(item.address && selected && item.address.toLowerCase() === selected.toLowerCase()),
    disabled: !item.address,
  }));
}
