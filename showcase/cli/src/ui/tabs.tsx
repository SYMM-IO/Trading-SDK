import { Box, Text } from "ink";
import { theme } from "../config/theme.js";
import { useMouseRegion } from "./mouse.js";

export interface TabDef {
  key: string;
  label: string;
}

/** The top navigation rail. Active tab is a filled coral pill with a number. */
export function Tabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly TabDef[];
  active: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <Box flexWrap="wrap">
      {tabs.map((tab, index) => (
        <Tab key={tab.key} tab={tab} index={index} active={tab.key === active} onSelect={onSelect} />
      ))}
    </Box>
  );
}

function Tab({
  tab,
  index,
  active,
  onSelect,
}: {
  tab: TabDef;
  index: number;
  active: boolean;
  onSelect?: (key: string) => void;
}) {
  const mouse = useMouseRegion(() => onSelect?.(tab.key), onSelect == null);
  return (
    <Box ref={mouse.ref} marginRight={1}>
      <Text
        color={active ? theme.onAccent : mouse.hovered ? theme.primaryBright : theme.muted}
        backgroundColor={active ? theme.primary : undefined}
        bold={active || mouse.hovered}
      >
        {` ${index + 1} ${tab.label} `}
      </Text>
    </Box>
  );
}
