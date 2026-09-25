import { Box, Text } from "ink";
import { glyph, theme } from "../config/theme.js";
import { useAppState } from "./app-state.js";
import { useGate } from "./gate.js";

export interface KeyHint {
  key: string;
  label: string;
}

/** A compact ` key label ` hint cluster. */
export function KeyHints({ hints }: { hints: readonly KeyHint[] }) {
  return (
    <Box flexShrink={1} flexWrap="wrap" justifyContent="flex-end">
      {hints.map((hint, index) => (
        <Box key={hint.key} marginRight={index < hints.length - 1 ? 2 : 0}>
          <Text color={theme.primaryBright} bold>
            {hint.key}
          </Text>
          <Text color={theme.faint}> {hint.label}</Text>
        </Box>
      ))}
    </Box>
  );
}

const BASE_HINTS: readonly KeyHint[] = [
  { key: "1-9", label: "tabs" },
  { key: "w", label: "wallet" },
  { key: "?", label: "help" },
  { key: "q", label: "quit" },
];

/** Bottom bar: the gate's next-action on the left, key hints on the right. */
export function StatusBar({ hints }: { hints?: readonly KeyHint[] }) {
  const gate = useGate();
  const { overlay } = useAppState();

  const dotColor = gate.isReady ? theme.positive : gate.isChecking ? theme.warning : theme.info;
  const marker = gate.isReady ? glyph.live : glyph.arrow;

  return (
    <Box justifyContent="space-between" paddingX={1} flexWrap="wrap">
      <Text>
        <Text color={dotColor}>{marker} </Text>
        <Text color={gate.isReady ? theme.positive : theme.text}>{gate.label}</Text>
        {overlay != null && <Text color={theme.faint}> {glyph.dot} esc to close</Text>}
      </Text>
      <KeyHints hints={hints ?? BASE_HINTS} />
    </Box>
  );
}
