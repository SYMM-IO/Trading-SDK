import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { theme } from "../config/theme.js";

/**
 * A centered modal panel. Overlays render in place of the active screen while
 * open, so this is just a focused, bordered card with a title and an optional
 * footer (actions / hints).
 */
export function Sheet({
  title,
  subtitle,
  width = 62,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Box flexGrow={1} justifyContent="center" paddingTop={1}>
      <Box
        width={width}
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.borderFocus}
        paddingX={2}
        paddingY={1}
      >
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={theme.primaryBright}>
            {title}
          </Text>
          {subtitle != null && <Text color={theme.faint}>{subtitle}</Text>}
        </Box>
        {children}
        {footer != null && <Box marginTop={1}>{footer}</Box>}
      </Box>
    </Box>
  );
}
