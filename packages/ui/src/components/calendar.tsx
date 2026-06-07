import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

export interface CalendarProps {
  /** The currently selected day. Time-of-day is ignored for highlighting. */
  selected?: Date;
  /** Fired with midnight of the clicked day (local time). */
  onSelect: (date: Date) => void;
  /** Days before this one (by calendar day) are disabled for selection. */
  fromDate?: Date;
  className?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * A compact month-grid date picker built from scratch (no calendar dependency),
 * styled to the design tokens. Controlled by `selected` / `onSelect`; the shown
 * month follows the selection and keyboard focus. The day grid implements the
 * WAI-ARIA roving-tabindex pattern — one tab stop, arrow keys to move, PageUp/
 * PageDown to change month. Pair it with {@link DateTimePicker} for a popover
 * field, or use it on its own.
 *
 * @example
 * <Calendar selected={date} onSelect={setDate} />
 */
function Calendar({ selected, onSelect, fromDate, className }: CalendarProps) {
  const today = startOfDay(new Date());
  const [focusedDate, setFocusedDate] = React.useState<Date>(() => startOfDay(selected ?? today));
  const gridRef = React.useRef<HTMLDivElement>(null);
  const shouldFocusRef = React.useRef(false);

  /** Follow the selection into its month when it changes (preset, typed value). */
  const selectedTime = selected?.getTime();
  React.useEffect(() => {
    if (selectedTime !== undefined) setFocusedDate(startOfDay(new Date(selectedTime)));
  }, [selectedTime]);

  /** Move DOM focus to the active day after a keyboard navigation. */
  const focusedTime = focusedDate.getTime();
  React.useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus();
  }, [focusedTime]);

  const viewMonth = startOfMonth(focusedDate);
  const year = viewMonth.getFullYear();
  const monthIndex = viewMonth.getMonth();
  const leadingBlanks = viewMonth.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const minDay = fromDate ? startOfDay(fromDate) : undefined;

  const cells: Array<number | null> = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function moveFocus(deltaDays: number) {
    shouldFocusRef.current = true;
    setFocusedDate(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate() + deltaDays));
  }

  function shiftMonth(delta: number, focus = false) {
    const targetDays = new Date(year, monthIndex + delta + 1, 0).getDate();
    const day = Math.min(focusedDate.getDate(), targetDays);
    if (focus) shouldFocusRef.current = true;
    setFocusedDate(new Date(year, monthIndex + delta, day));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-7);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(7);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(-focusedDate.getDay());
        break;
      case "End":
        event.preventDefault();
        moveFocus(6 - focusedDate.getDay());
        break;
      case "PageUp":
        event.preventDefault();
        shiftMonth(-1, true);
        break;
      case "PageDown":
        event.preventDefault();
        shiftMonth(1, true);
        break;
      default:
        break;
    }
  }

  return (
    <div className={cn("w-64", className)} data-slot="calendar">
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium" aria-live="polite">
          {MONTHS[monthIndex]} {year}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div role="grid" aria-label={`${MONTHS[monthIndex]} ${year}`} ref={gridRef} onKeyDown={handleKeyDown}>
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              role="columnheader"
              className="text-muted-foreground py-1 text-center text-[0.7rem] font-medium"
            >
              {weekday}
            </span>
          ))}
        </div>

        {weeks.map((week, weekIndex) => (
          <div role="row" key={`week-${weekIndex}`} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIndex) => {
              if (day === null) return <span role="gridcell" key={`blank-${weekIndex}-${dayIndex}`} />;
              const date = new Date(year, monthIndex, day);
              const isSelected = Boolean(selected && isSameDay(date, selected));
              const isToday = isSameDay(date, today);
              const isFocused = isSameDay(date, focusedDate);
              const isDisabled = Boolean(minDay && date < minDay);

              return (
                <span role="gridcell" key={`day-${day}`} aria-selected={isSelected} className="flex justify-center">
                  <button
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    data-focused={isFocused || undefined}
                    aria-disabled={isDisabled || undefined}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${MONTHS[monthIndex]} ${day}, ${year}${isToday ? ", today" : ""}`}
                    onClick={() => {
                      if (!isDisabled) onSelect(date);
                    }}
                    className={cn(
                      "focus-visible:ring-ring/40 inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors outline-none focus-visible:ring-2",
                      isDisabled && "pointer-events-none opacity-40",
                      isSelected ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground",
                      !isSelected && isToday && "ring-border ring-1",
                    )}
                  >
                    {day}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export { Calendar };
