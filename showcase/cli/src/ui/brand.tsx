import { Box, Text } from "ink";
import { glyph, theme } from "../config/theme.js";

/** The compact wordmark used in the top bar. */
export function Brand() {
  return (
    <Text bold>
      <Text color={theme.primary}>{glyph.brand} </Text>
      <Text color={theme.text}>SYMMIO</Text>
      <Text color={theme.faint}> FRONTIER</Text>
    </Text>
  );
}

const DIAMOND = ["    ◆    ", "  ◆◆◆◆◆  ", "◆◆◆◆◆◆◆◆◆", "  ◆◆◆◆◆  ", "    ◆    "];
const DIAMOND_TONES = [theme.primaryDeep, theme.primary, theme.primaryBright, theme.primary, theme.primaryDeep];

/** The full splash wordmark — a coral diamond beside the spaced name. */
export function Wordmark() {
  return (
    <Box>
      <Box flexDirection="column" marginRight={2}>
        {DIAMOND.map((line, index) => (
          <Text key={index} color={DIAMOND_TONES[index]}>
            {line}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" justifyContent="center">
        <Text bold color={theme.text}>
          S Y M M I O
        </Text>
        <Text color={theme.primary}>─────────────</Text>
        <Text bold color={theme.primaryBright}>
          F R O N T I E R
        </Text>
        <Text color={theme.faint}>terminal perps DEX</Text>
      </Box>
    </Box>
  );
}
