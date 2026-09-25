import { Box, Text } from "ink";
import { theme } from "../../config/theme.js";
import { pad } from "../../ui/pad.js";
import { Sheet } from "../../ui/sheet.js";

interface Row {
  keys: string;
  label: string;
}

const COLUMNS: readonly (readonly { title: string; rows: Row[] }[])[] = [
  [
    {
      title: "Global",
      rows: [
        { keys: "1–9 / tab", label: "switch/cycle tabs" },
        { keys: "mouse", label: "select tabs, menus, options" },
        { keys: "x / e / w", label: "chain/env/wallet" },
        { keys: "? / esc / q", label: "help/close/quit" },
      ],
    },
    {
      title: "Lists & forms",
      rows: [
        { keys: "↑↓ / j k", label: "move" },
        { keys: "←→ / h l", label: "adjust" },
        { keys: "⏎", label: "select / submit" },
        { keys: "/", label: "search" },
      ],
    },
    {
      title: "Trade & positions",
      rows: [
        { keys: "⏎", label: "preview / submit" },
        { keys: "c / g", label: "close / group close" },
        { keys: "m / t", label: "margin / TP-SL" },
        { keys: "a / C", label: "manage / close all" },
      ],
    },
  ],
  [
    {
      title: "Activity & analytics",
      rows: [
        { keys: "v / f / n p", label: "view/filter/page" },
        { keys: "←→", label: "cycle market" },
        { keys: "/", label: "search market" },
        { keys: "[ ] / s", label: "timeframe/probe" },
        { keys: "r", label: "refresh" },
      ],
    },
    {
      title: "Pools",
      rows: [
        { keys: "v / s / d", label: "catalog/status/detail" },
        { keys: "n / p / r", label: "page / refresh" },
        { keys: "a / o", label: "sign in / out" },
      ],
    },
    {
      title: "Gasless",
      rows: [
        { keys: "[ ] / , .", label: "section / wallet" },
        { keys: "s", label: "settle wallet" },
        { keys: "⏎", label: "submit form" },
        { keys: "u / p / r", label: "replay/recent/reload" },
      ],
    },
    {
      title: "Accounts & system",
      rows: [
        { keys: "n / r / d", label: "new / rename / delete" },
        { keys: "r", label: "refresh health" },
      ],
    },
  ],
];

function HelpColumn({ sections }: { sections: (typeof COLUMNS)[number] }) {
  return (
    <Box flexDirection="column" width={35}>
      {sections.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Text bold color={theme.primaryBright}>
            {section.title}
          </Text>
          {section.rows.map((row) => (
            <Text key={row.keys}>
              <Text color={theme.primary}>{pad(row.keys, 13)}</Text>
              <Text color={theme.muted}>{row.label}</Text>
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

/** The keybindings reference overlay. */
export function HelpSheet() {
  return (
    <Sheet title="Keybindings" subtitle="esc closes overlays" width={76}>
      <Box>
        {COLUMNS.map((sections, index) => (
          <HelpColumn key={index} sections={sections} />
        ))}
      </Box>
    </Sheet>
  );
}
