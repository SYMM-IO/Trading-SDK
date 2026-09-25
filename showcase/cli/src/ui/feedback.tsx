import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ReactNode } from "react";
import { glyph, theme } from "../config/theme.js";

/** A spinner with an optional label — the app's standard loading line. */
export function LoadingLine({ label, color = theme.primary }: { label?: string; color?: string }) {
  return (
    <Text color={color}>
      <Spinner type="dots" />
      {label != null ? ` ${label}` : ""}
    </Text>
  );
}

/** A centered empty / call-to-action state inside a panel. */
export function Empty({ title, hint, tone = theme.muted }: { title: string; hint?: ReactNode; tone?: string }) {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" paddingY={1} flexGrow={1}>
      <Text color={tone}>{title}</Text>
      {hint != null && (
        <Box marginTop={1}>
          <Text color={theme.faint}>{hint}</Text>
        </Box>
      )}
    </Box>
  );
}

/** An inline error line. */
export function ErrorLine({ message }: { message: string }) {
  return (
    <Text color={theme.negative}>
      {glyph.cross} {message}
    </Text>
  );
}

/** An inline success line. */
export function SuccessLine({ message }: { message: string }) {
  return (
    <Text color={theme.positive}>
      {glyph.check} {message}
    </Text>
  );
}
