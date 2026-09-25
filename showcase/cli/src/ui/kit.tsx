import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { glyph, theme } from "../config/theme.js";

/**
 * Static presentation primitives — panels, stat tiles, badges, dividers. These
 * define the terminal's visual grammar; every screen composes them so the app
 * reads as one system.
 */

interface PanelProps {
  title?: string;
  /** Rendered at the right edge of the title row (status, count, hint). */
  right?: ReactNode;
  focused?: boolean;
  flexGrow?: number;
  width?: number | string;
  minHeight?: number;
  paddingY?: number;
  children: ReactNode;
}

/** A rounded, titled panel. The border brightens to coral when focused. */
export function Panel({ title, right, focused, flexGrow, width, minHeight, paddingY, children }: PanelProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? theme.borderFocus : theme.border}
      paddingX={1}
      paddingY={paddingY}
      flexGrow={flexGrow}
      width={width}
      minHeight={minHeight}
    >
      {title != null && (
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={focused ? theme.primaryBright : theme.text}>
            {title}
          </Text>
          {right != null && <Box>{right}</Box>}
        </Box>
      )}
      {children}
    </Box>
  );
}

/** A label-over-value stat tile. */
export function Stat({
  label,
  value,
  color,
  hint,
  minWidth,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
  minWidth?: number;
}) {
  return (
    <Box flexDirection="column" minWidth={minWidth}>
      <Text color={theme.muted}>{label}</Text>
      <Text bold color={color ?? theme.text}>
        {value}
      </Text>
      {hint != null && <Text color={theme.faint}>{hint}</Text>}
    </Box>
  );
}

/** An inline `label ……… value` row. */
export function KeyValue({
  label,
  value,
  color,
  dim,
}: {
  label: string;
  value: string;
  color?: string;
  dim?: boolean;
}) {
  return (
    <Box justifyContent="space-between">
      <Text color={dim ? theme.faint : theme.muted}>{label}</Text>
      <Text color={color ?? (dim ? theme.muted : theme.text)}>{value}</Text>
    </Box>
  );
}

/** A colored pill. `tone` picks the accent; text sits on a faint tint. */
export function Badge({ label, color = theme.primary }: { label: string; color?: string }) {
  return (
    <Text color={color} bold>
      {" "}
      {label}{" "}
    </Text>
  );
}

/** A status dot + label (live / idle / warn). */
export function StatusDot({ color, label }: { color: string; label?: string }) {
  return (
    <Text color={color}>
      {glyph.live}
      {label != null ? ` ${label}` : ""}
    </Text>
  );
}

/** Muted secondary text. */
export function Muted({ children }: { children: ReactNode }) {
  return <Text color={theme.muted}>{children}</Text>;
}

/** Faint tertiary text (hints, scaffolding). */
export function Hint({ children }: { children: ReactNode }) {
  return <Text color={theme.faint}>{children}</Text>;
}

/** A full-width horizontal rule. */
export function Divider({ width = 40, color = theme.border }: { width?: number; color?: string }) {
  return <Text color={color}>{"─".repeat(Math.max(0, width))}</Text>;
}

/** A big screen title with an accent bullet. */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Text bold color={theme.text}>
        <Text color={theme.primary}>{glyph.brand} </Text>
        {title}
      </Text>
      {subtitle != null && <Text color={theme.faint}>{subtitle}</Text>}
    </Box>
  );
}
