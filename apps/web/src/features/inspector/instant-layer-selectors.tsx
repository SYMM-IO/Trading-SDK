import { SuggestionList, SuggestionListItem } from "@symm-frontier/ui/components/suggestion-list";
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

interface Props {
  selected: readonly Hex[];
  mode: "single" | "multiple";
  onPick: (selector: Hex) => void;
}

/** Suggested Instant Layer selectors from Vibe-ui v1 delegation docs. */
export function InstantLayerSelectorSuggestions({ selected, onPick }: Props) {
  return (
    <SuggestionList>
      {INSTANT_LAYER_V1_SELECTOR_SUGGESTIONS.map((item) => (
        <SuggestionListItem
          key={item.selector}
          title={item.name}
          meta={item.selector}
          selected={selected.includes(item.selector)}
          onClick={() => onPick(item.selector)}
          data-testid="button-selector-suggestion"
        />
      ))}
    </SuggestionList>
  );
}

export function formatSelectorList(selectors: readonly Hex[]): string {
  return selectors.join(", ");
}
