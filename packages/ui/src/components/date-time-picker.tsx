import { Calendar as CalendarIcon, Clock } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";

export interface DateTimePickerProps {
  /** Namespaces the field `id` and every `data-testid`. */
  idPrefix: string;
  /** The free-text value shown in the field. The consumer owns its format. */
  value: string;
  onValueChange: (value: string) => void;
  /**
   * The parsed date the calendar and time row reflect — derive it from `value`.
   * `undefined` leaves the calendar unselected (shown on the current month).
   */
  date?: Date;
  /** Fired with the combined date whenever a day or the time is changed. */
  onDateChange: (date: Date) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Accessible label for the trailing trigger button. */
  triggerLabel?: string;
  /** Show the HH:MM time row under the calendar. Defaults to `true`. */
  withTime?: boolean;
  /** Days before this one are disabled in the calendar. */
  fromDate?: Date;
  /** Content rendered under the time row, e.g. quick-set presets. */
  footer?: React.ReactNode;
  /** Render the field text in the mono face. */
  mono?: boolean;
  inputMode?: React.ComponentProps<"input">["inputMode"];
  className?: string;
}

/**
 * A free-text field with a trailing calendar button that opens a day grid and a
 * time row. The text input stays fully editable — the consumer maps it to/from a
 * `Date` (e.g. a unix timestamp) — while the popover offers point-and-click
 * date/time entry. Picking a day preserves the existing time-of-day (including
 * seconds typed into the field), so the popover never silently drops precision.
 *
 * @example
 * <DateTimePicker
 *   idPrefix="expiry"
 *   value={text}
 *   onValueChange={setText}
 *   date={text ? new Date(Number(text) * 1000) : undefined}
 *   onDateChange={(d) => setText(Math.floor(d.getTime() / 1000).toString())}
 * />
 */
function DateTimePicker({
  idPrefix,
  value,
  onValueChange,
  date,
  onDateChange,
  placeholder,
  invalid,
  disabled,
  triggerLabel = "Pick date and time",
  withTime = true,
  fromDate,
  footer,
  mono = false,
  inputMode,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const hours = date ? date.getHours() : 0;
  const minutes = date ? date.getMinutes() : 0;

  function base(): Date {
    if (date) return date;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function emit(year: number, month: number, day: number, h: number, m: number, s: number) {
    onDateChange(new Date(year, month, day, h, m, s));
  }

  function handleDaySelect(day: Date) {
    const b = base();
    emit(day.getFullYear(), day.getMonth(), day.getDate(), b.getHours(), b.getMinutes(), b.getSeconds());
    if (!withTime) setOpen(false);
  }

  function handleHours(next: number) {
    const b = base();
    emit(b.getFullYear(), b.getMonth(), b.getDate(), clamp(next, 0, 23), b.getMinutes(), b.getSeconds());
  }

  function handleMinutes(next: number) {
    const b = base();
    emit(b.getFullYear(), b.getMonth(), b.getDate(), b.getHours(), clamp(next, 0, 59), b.getSeconds());
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <Input
            id={`${idPrefix}-field`}
            data-testid={`${idPrefix}-field`}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            inputMode={inputMode}
            className={cn("pr-10", mono && "font-mono")}
            aria-invalid={invalid}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid={`${idPrefix}-open`}
              aria-label={triggerLabel}
              aria-expanded={open}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <CalendarIcon className="size-4" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>

      <PopoverContent align="start" sideOffset={6} className="w-auto" data-testid={`${idPrefix}-picker`}>
        <Calendar selected={date} onSelect={handleDaySelect} fromDate={fromDate} />

        {withTime ? (
          <div className="border-border/70 mt-3 flex items-center gap-2 border-t pt-3">
            <Clock className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <div className="flex items-center gap-1">
              <TimeInput value={hours} max={23} ariaLabel="Hours" testId={`${idPrefix}-hours`} onCommit={handleHours} />
              <span className="text-muted-foreground">:</span>
              <TimeInput
                value={minutes}
                max={59}
                ariaLabel="Minutes"
                testId={`${idPrefix}-minutes`}
                onCommit={handleMinutes}
              />
            </div>
          </div>
        ) : null}

        {footer ? <div className="border-border/70 mt-3 border-t pt-3">{footer}</div> : null}
      </PopoverContent>
    </Popover>
  );
}

function TimeInput({
  value,
  max,
  ariaLabel,
  testId,
  onCommit,
}: {
  value: number;
  max: number;
  ariaLabel: string;
  testId: string;
  onCommit: (next: number) => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      data-testid={testId}
      value={pad2(value)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        if (digits === "") {
          onCommit(0);
          return;
        }
        onCommit(clamp(Number(digits), 0, max));
      }}
      onFocus={(event) => event.target.select()}
      className="bg-input/40 border-border focus-visible:border-ring focus-visible:ring-ring/30 h-8 w-10 rounded-md border text-center font-mono text-sm tabular-nums outline-none focus-visible:ring-3"
    />
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export { DateTimePicker };
