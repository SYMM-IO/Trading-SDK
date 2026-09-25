import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { glyph, theme } from "../config/theme.js";
import { useMouseRegion } from "./mouse.js";

const SGR_MOUSE_INPUT = /\[<\d+;\d+;\d+[Mm]/g;

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  focused: boolean;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  invalid?: boolean;
  labelWidth?: number;
}

/**
 * A labeled text input. Only the focused field captures keystrokes and shows a
 * cursor; the label and caret brighten to coral when focused, and `invalid`
 * turns the hint rose.
 */
export function Field({
  label,
  value,
  onChange,
  onSubmit,
  focused,
  placeholder,
  suffix,
  hint,
  invalid,
  labelWidth = 13,
}: FieldProps) {
  function handleChange(nextValue: string): void {
    onChange(nextValue.replaceAll(SGR_MOUSE_INPUT, ""));
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={labelWidth}>
          <Text color={focused ? theme.primaryBright : theme.muted}>{label}</Text>
        </Box>
        <Text color={focused ? theme.borderFocus : theme.faint}>{focused ? glyph.caret : " "} </Text>
        <Box minWidth={12}>
          <TextInput
            value={value}
            onChange={handleChange}
            onSubmit={onSubmit}
            placeholder={placeholder}
            focus={focused}
            showCursor={focused}
          />
        </Box>
        {suffix != null && <Text color={theme.muted}> {suffix}</Text>}
      </Box>
      {hint != null && (
        <Box marginLeft={labelWidth + 2}>
          <Text color={invalid ? theme.negative : theme.faint}>{hint}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * A `◄ value ►` stepper row. Presentational — the parent adjusts `value` with
 * left/right arrows. No text entry, so there is no default to delete first.
 */
export function StepperRow({
  label,
  value,
  focused,
  hint,
  labelWidth = 13,
}: {
  label: string;
  value: string;
  focused: boolean;
  hint?: string;
  labelWidth?: number;
}) {
  return (
    <Box>
      <Box width={labelWidth}>
        <Text color={focused ? theme.primaryBright : theme.muted}>{label}</Text>
      </Box>
      <Text color={focused ? theme.borderFocus : theme.faint}>{focused ? glyph.caret : " "} </Text>
      <Text color={focused ? theme.text : theme.faint}>◄ </Text>
      <Text bold color={theme.text}>
        {value}
      </Text>
      <Text color={focused ? theme.text : theme.faint}> ►</Text>
      {hint != null && <Text color={theme.faint}> {hint}</Text>}
    </Box>
  );
}

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  color?: string;
}

/**
 * A horizontal segmented control. The parent cycles `value` with left/right
 * arrows and may provide `onChange` for mouse selection. The selected segment
 * fills with its accent color.
 */
export function Segmented<T extends string>({
  options,
  value,
  focused,
  onChange,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  focused?: boolean;
  onChange?: (value: T) => void;
}) {
  return (
    <Box>
      {options.map((option) => (
        <Segment
          key={option.key}
          option={option}
          selected={option.key === value}
          focused={focused}
          onChange={onChange}
        />
      ))}
    </Box>
  );
}

function Segment<T extends string>({
  option,
  selected,
  focused,
  onChange,
}: {
  option: SegmentOption<T>;
  selected: boolean;
  focused?: boolean;
  onChange?: (value: T) => void;
}) {
  const mouse = useMouseRegion(() => onChange?.(option.key), onChange == null);
  const accent = option.color ?? theme.primary;

  return (
    <Box ref={mouse.ref} marginRight={1}>
      <Text
        color={selected ? theme.onAccent : focused || mouse.hovered ? theme.muted : theme.faint}
        backgroundColor={selected ? accent : undefined}
        bold={selected || mouse.hovered}
      >
        {` ${option.label} `}
      </Text>
    </Box>
  );
}
