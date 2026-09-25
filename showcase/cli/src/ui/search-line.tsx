import { Box, Text } from "ink";
import { glyph, theme } from "../config/theme.js";

interface Props {
  query: string;
  searching: boolean;
  /**
   * What `esc` does while the box has focus. Overlays close on `esc` app-wide
   * (the shell handles it before any sheet sees the key), so a sheet passes
   * `"close"`; a full-screen tab keeps the default.
   */
  escLabel?: string;
}

/**
 * The incremental `/` search prompt shown above a filterable list. Renders the
 * live query and its own cursor while searching, the standing filter once the
 * box loses focus, and the key hints when idle.
 */
export function SearchLine({ query, searching, escLabel = "clear" }: Props) {
  return (
    <Box marginBottom={1}>
      {searching ? (
        <Text>
          <Text color={theme.primaryBright}>{glyph.caret} </Text>
          <Text color={theme.text}>{query}</Text>
          <Text color={theme.primaryBright}>▌</Text>
          <Text color={theme.faint}>
            {" "}
            {glyph.dot} ⏎ select {glyph.dot} esc {escLabel}
          </Text>
        </Text>
      ) : query ? (
        <Text>
          <Text color={theme.muted}>filter </Text>
          <Text color={theme.text}>{query}</Text>
          <Text color={theme.faint}> {glyph.dot} / edit</Text>
        </Text>
      ) : (
        <Text color={theme.faint}>
          / search {glyph.dot} ↑↓ move {glyph.dot} ⏎ select
        </Text>
      )}
    </Box>
  );
}
