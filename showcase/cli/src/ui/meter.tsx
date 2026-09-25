import { Text } from "ink";
import { theme } from "../config/theme.js";

/** A horizontal fill meter in `[0,1]`. */
export function Meter({
  value,
  width = 18,
  color = theme.primary,
  track = theme.border,
}: {
  value: number;
  width?: number;
  color?: string;
  track?: string;
}) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const filled = Math.round(clamped * width);
  return (
    <Text>
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text color={track}>{"░".repeat(Math.max(0, width - filled))}</Text>
    </Text>
  );
}

const BLOCKS = "▁▂▃▄▅▆▇█";

/** A unicode sparkline from a numeric series; colored by net direction. */
export function Sparkline({ data, width, color }: { data: number[]; width?: number; color?: string }) {
  const series = width ? data.slice(-width) : data;
  if (series.length < 2) return <Text color={theme.faint}>{"·".repeat(width ?? 8)}</Text>;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const chars = series
    .map((value) => BLOCKS[Math.min(7, Math.max(0, Math.floor(((value - min) / range) * 7.999)))])
    .join("");
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;
  const tone = color ?? (last >= first ? theme.positive : theme.negative);
  return <Text color={tone}>{chars}</Text>;
}
