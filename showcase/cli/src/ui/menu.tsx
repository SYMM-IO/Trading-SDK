import { Box, Text, useInput } from "ink";
import type { ReactNode } from "react";
import { glyph, theme } from "../config/theme.js";
import { useMouseRegion } from "./mouse.js";

interface MenuProps<T> {
  items: readonly T[];
  /** Controlled selection index (parent owns it so side panels can react). */
  index: number;
  setIndex: (index: number) => void;
  /** Whether this menu should capture keyboard input right now. */
  active: boolean;
  /** Mouse can remain active when keyboard navigation is owned elsewhere. */
  mouseActive?: boolean;
  onSelect?: (item: T, index: number) => void;
  renderItem: (item: T, selected: boolean, index: number) => ReactNode;
  maxVisible?: number;
  emptyLabel?: string;
}

/**
 * A vertical, keyboard-navigable list with a scrolling viewport. Selection is
 * controlled; arrow keys / `j` `k` move, Enter selects. Only captures input
 * when `active`, so multiple lists and forms coexist without key conflicts.
 */
export function Menu<T>({
  items,
  index,
  setIndex,
  active,
  mouseActive = active,
  onSelect,
  renderItem,
  maxVisible = 10,
  emptyLabel,
}: MenuProps<T>) {
  useInput(
    (input, key) => {
      if (items.length === 0) return;
      if (key.downArrow || input === "j") setIndex(Math.min(items.length - 1, index + 1));
      else if (key.upArrow || input === "k") setIndex(Math.max(0, index - 1));
      else if (input === "g") setIndex(0);
      else if (input === "G") setIndex(items.length - 1);
      else if (key.return && onSelect) {
        const item = items[index];
        if (item !== undefined) onSelect(item, index);
      }
    },
    { isActive: active },
  );

  if (items.length === 0) {
    return <Text color={theme.faint}>{emptyLabel ?? "Nothing here yet."}</Text>;
  }

  const clamped = Math.max(0, Math.min(items.length - 1, index));
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(0, clamped - half);
  const end = Math.min(items.length, start + maxVisible);
  start = Math.max(0, end - maxVisible);
  const window = items.slice(start, end);

  return (
    <Box flexDirection="column">
      {start > 0 && (
        <Text color={theme.faint}>
          {" "}
          {glyph.up} {start} more
        </Text>
      )}
      {window.map((item, offset) => {
        const realIndex = start + offset;
        return (
          <MenuRow
            key={realIndex}
            item={item}
            index={realIndex}
            selected={realIndex === clamped}
            active={mouseActive}
            setIndex={setIndex}
            onSelect={onSelect}
            renderItem={renderItem}
          />
        );
      })}
      {end < items.length && (
        <Text color={theme.faint}>
          {" "}
          {glyph.down} {items.length - end} more
        </Text>
      )}
    </Box>
  );
}

function MenuRow<T>({
  item,
  index,
  selected,
  active,
  setIndex,
  onSelect,
  renderItem,
}: {
  item: T;
  index: number;
  selected: boolean;
  active: boolean;
  setIndex: (index: number) => void;
  onSelect?: (item: T, index: number) => void;
  renderItem: (item: T, selected: boolean, index: number) => ReactNode;
}) {
  const mouse = useMouseRegion(() => {
    setIndex(index);
    onSelect?.(item, index);
  }, !active);
  const highlighted = selected || mouse.hovered;

  return (
    <Box ref={mouse.ref}>
      <Text color={highlighted ? theme.primaryBright : theme.faint}>{highlighted ? `${glyph.caret} ` : "  "}</Text>
      {renderItem(item, highlighted, index)}
    </Box>
  );
}
