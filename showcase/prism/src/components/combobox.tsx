"use client";

import { cn } from "@/lib/cn";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ComboboxOption<T extends string> {
  value: T;
  /** Primary line, and the first thing the search matches. */
  label: string;
  /** Muted caption on the row's right edge — an address, a balance. */
  hint?: string;
  /** Extra text the search should match but the row should not show. */
  keywords?: string;
}

export interface ComboboxGroup<T extends string> {
  /** Stable key. Collapse state is held against it. */
  key: string;
  label: string;
  /** Right-aligned caption on the header. Defaults to the option count. */
  caption?: string;
  /** CSS color for the header's tone dot, e.g. `var(--mj-500)`. */
  accent?: string;
  /** Compact name for the trigger, when the full label is too long there. */
  short?: string;
  options: readonly ComboboxOption<T>[];
}

/** Everything the single- and multi-select variants configure identically. */
export interface ComboboxSharedProps<T extends string> {
  /** Accessible name — the visible micro-label is rendered by the caller. */
  label: string;
  /** Ungrouped options, rendered above every group — e.g. an "All" row. */
  options?: readonly ComboboxOption<T>[];
  /** Grouped options. Each group collapses as a unit. */
  groups?: readonly ComboboxGroup<T>[];
  /** Shows the filter field. Worth it once the list outgrows a glance. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown when the filter matches nothing. */
  emptyText?: string;
  /** Pinned under the list — a count, a link to manage the entities. */
  footer?: ReactNode;
  /** `xs` for a control docked inside a panel header, `md` for a filter bar. */
  size?: "xs" | "sm" | "md";
  /** Which trigger edge the popover hangs from. */
  align?: "start" | "end";
  /** Popover width in px. It never renders narrower than the trigger. */
  menuWidth?: number;
  disabled?: boolean;
  className?: string;
}

export interface ComboboxProps<T extends string> extends ComboboxSharedProps<T> {
  value: T;
  onChange: (value: T) => void;
  /** Shown on the trigger when `value` matches no option. */
  placeholder?: string;
}

export interface MultiComboboxProps<T extends string> extends ComboboxSharedProps<T> {
  /** The selected values. An empty selection is a legitimate state, not a bug. */
  values: readonly T[];
  onChange: (values: readonly T[]) => void;
  /** Trigger label while nothing is selected — e.g. "All accounts". */
  emptyLabel: string;
  /** Noun for the "3 accounts" summary the trigger shows past one selection. */
  noun: string;
  /** Adds an all / none toggle to each group header. Worth it past a few rows. */
  groupToggle?: boolean;
}

const SIZES = {
  xs: { trigger: "h-[22px] gap-1.5 rounded-xs px-1.5 font-mono text-2xs", row: "font-mono text-2xs" },
  sm: { trigger: "h-6 gap-2 rounded-md px-2.5 text-sm", row: "text-sm" },
  md: { trigger: "h-[30px] gap-2 rounded-md px-2.5 text-sm", row: "text-sm" },
} as const;

/**
 * Single-select combobox: a trigger, a popover list, optional filter field and
 * collapsible groups.
 *
 * A native `select` cannot show a second line per row, cannot be filtered, and
 * cannot group anything the user is allowed to fold away — and its popup is
 * drawn by the OS, so it is the one control in the app that ignores the design
 * system entirely. This replaces it wherever the option list is unbounded.
 *
 * Keyboard behaviour follows the listbox pattern: arrows move the active row,
 * Enter commits it, Escape closes and returns focus to the trigger. While the
 * filter is non-empty every group is force-expanded — a collapsed group must
 * never hide a match.
 */
export function Combobox<T extends string>({
  value,
  onChange,
  placeholder = "Select…",
  options = [],
  groups = [],
  ...shared
}: ComboboxProps<T>) {
  const selected = useMemo(() => new Set<T>([value]), [value]);
  const current = useMemo(() => findOption(options, groups, value), [options, groups, value]);

  return (
    <ComboboxShell
      {...shared}
      options={options}
      groups={groups}
      selected={selected}
      preferredActive={value}
      onSelect={onChange}
      closeOnSelect
      multiple={false}
      trigger={
        <>
          {current?.group?.accent ? <ToneDot color={current.group.accent} /> : null}
          <span className="truncate">{current?.option.label ?? placeholder}</span>
          {current?.group ? (
            <span className="shrink-0 text-fg-3">{current.group.short ?? current.group.label}</span>
          ) : null}
        </>
      }
    />
  );
}

/**
 * Multi-select combobox: the same list, but a row toggles instead of commits
 * and the popover stays open so a set can be built in one pass.
 *
 * Selecting nothing means "no narrowing" rather than "no rows" — a filter that
 * can be emptied into showing zero results is a trap, and the trigger says
 * `emptyLabel` in that state so the widened scope is never a silent one.
 */
export function MultiCombobox<T extends string>({
  values,
  onChange,
  emptyLabel,
  noun,
  groupToggle = false,
  options = [],
  groups = [],
  ...shared
}: MultiComboboxProps<T>) {
  const selected = useMemo(() => new Set<T>(values), [values]);

  const toggle = useCallback(
    (value: T) => onChange(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]),
    [values, onChange],
  );

  /* A group toggle is all-or-nothing over that group: any unselected row means
     the action is "select the rest", never "clear what is already chosen". */
  const toggleGroup = useCallback(
    (group: ComboboxGroup<T>) => {
      const members = group.options.map((option) => option.value);
      const complete = members.every((member) => selected.has(member));
      onChange(
        complete
          ? values.filter((entry) => !members.includes(entry))
          : [...values, ...members.filter((member) => !selected.has(member))],
      );
    },
    [values, selected, onChange],
  );

  const only = values.length === 1 ? findOption(options, groups, values[0]!) : undefined;

  return (
    <ComboboxShell
      {...shared}
      options={options}
      groups={groups}
      selected={selected}
      preferredActive={values[0]}
      onSelect={toggle}
      closeOnSelect={false}
      multiple
      groupAction={
        groupToggle
          ? (group) => {
              const complete = group.options.every((option) => selected.has(option.value));
              return (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`${complete ? "Clear" : "Select"} ${group.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleGroup(group);
                  }}
                  className="cursor-pointer rounded-xs px-1 py-0.5 text-2xs text-fg-3 hover:bg-bg-3 hover:text-fg-1"
                >
                  {complete ? "none" : "all"}
                </span>
              );
            }
          : undefined
      }
      trigger={
        <>
          {only?.group?.accent ? <ToneDot color={only.group.accent} /> : null}
          <span className={cn("truncate", values.length === 0 && "text-fg-2")}>
            {values.length === 0 ? emptyLabel : (only?.option.label ?? `${values.length} ${noun}s`)}
          </span>
          {only?.group ? <span className="shrink-0 text-fg-3">{only.group.short ?? only.group.label}</span> : null}
        </>
      }
    />
  );
}

interface ComboboxShellProps<T extends string> extends ComboboxSharedProps<T> {
  /** Everything currently chosen. One entry in single-select. */
  selected: ReadonlySet<T>;
  /** Where the keyboard starts when the popover opens, if it is still visible. */
  preferredActive?: T;
  onSelect: (value: T) => void;
  /** Single-select commits and closes; multi-select keeps building the set. */
  closeOnSelect: boolean;
  /** Drives the row marker and the listbox's `aria-multiselectable`. */
  multiple: boolean;
  /** Rendered inside the trigger, left of the chevron. */
  trigger: ReactNode;
  /** Extra control on a group header — the multi variant's all / none toggle. */
  groupAction?: (group: ComboboxGroup<T>) => ReactNode;
}

/** The popover, list, filter and keyboard behaviour both variants share. */
function ComboboxShell<T extends string>({
  label,
  options = [],
  groups = [],
  searchable = false,
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  footer,
  size = "md",
  align = "start",
  menuWidth = 260,
  disabled = false,
  className,
  selected,
  preferredActive,
  onSelect,
  closeOnSelect,
  multiple,
  trigger,
  groupAction,
}: ComboboxShellProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<readonly string[]>([]);
  const [active, setActive] = useState<T | undefined>(undefined);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowsRef = useRef(new Map<T, HTMLElement>());

  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (option: T) => `${baseId}-${option}`;

  const query = search.trim().toLowerCase();

  /* Groups only collapse when nothing is being searched for. */
  const isCollapsed = useCallback((key: string) => query.length === 0 && collapsed.includes(key), [collapsed, query]);

  const visible = useMemo(() => {
    const flat = options.filter((option) => matches(option, query));
    const matched = groups
      .map((group) => ({
        group,
        /* A group whose own name matches keeps all its rows — searching
           "lowcaps" should list that deployment, not filter inside it. */
        options: group.label.toLowerCase().includes(query)
          ? group.options
          : group.options.filter((option) => matches(option, query)),
      }))
      .filter((entry) => entry.options.length > 0);
    return { flat, groups: matched };
  }, [options, groups, query]);

  /** Every row the arrow keys can reach, in the order they are painted. */
  const navigable = useMemo(() => {
    const values = visible.flat.map((option) => option.value);
    for (const entry of visible.groups) {
      if (isCollapsed(entry.group.key)) continue;
      values.push(...entry.options.map((option) => option.value));
    }
    return values;
  }, [visible, isCollapsed]);

  /* Keep the active row on something that exists: the current selection when
     it survives the filter, otherwise the first row that did. */
  useEffect(() => {
    if (!open) return;
    setActive((current) => {
      if (current && navigable.includes(current)) return current;
      if (preferredActive && navigable.includes(preferredActive)) return preferredActive;
      return navigable[0];
    });
  }, [open, navigable, preferredActive]);

  useEffect(() => {
    if (!open || !active) return;
    rowsRef.current.get(active)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  /* The popover traps nothing, so the outside click and Escape are handled at
     the document — focus may be anywhere when either happens. */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setSearch("");
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function commit(next: T) {
    onSelect(next);
    if (!closeOnSelect) return;
    setOpen(false);
    triggerRef.current?.focus();
  }

  function move(step: 1 | -1) {
    if (navigable.length === 0) return;
    const index = active ? navigable.indexOf(active) : -1;
    const next =
      index === -1 ? (step === 1 ? 0 : navigable.length - 1) : (index + step + navigable.length) % navigable.length;
    setActive(navigable[next]);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
        break;
      case "Home":
      case "End":
        event.preventDefault();
        setActive(event.key === "Home" ? navigable[0] : navigable[navigable.length - 1]);
        break;
      case "Enter":
        event.preventDefault();
        if (active) commit(active);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  function toggleGroup(key: string) {
    setCollapsed((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  function renderRow(option: ComboboxOption<T>, indented: boolean) {
    const isSelected = selected.has(option.value);
    return (
      <button
        key={option.value}
        id={optionId(option.value)}
        ref={(node) => {
          if (node) rowsRef.current.set(option.value, node);
          else rowsRef.current.delete(option.value);
        }}
        type="button"
        role="option"
        aria-selected={isSelected}
        tabIndex={-1}
        onClick={() => commit(option.value)}
        onPointerMove={() => setActive(option.value)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 border-l-2 py-1.5 pr-2.5 text-left",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          indented ? "pl-6" : "pl-2.5",
          option.value === active ? "bg-bg-2" : null,
          isSelected ? "border-accent" : "border-transparent",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            SIZES[size].row,
            isSelected ? "font-semibold text-fg-0" : "text-fg-1",
          )}
        >
          {option.label}
        </span>
        {option.hint ? <span className="tnum shrink-0 text-2xs text-fg-3">{option.hint}</span> : null}
        <RowMarker checked={isSelected} multiple={multiple} />
      </button>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex w-full cursor-pointer items-center border bg-bg-0 font-sans whitespace-nowrap outline-none",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "hover:border-line-strong hover:text-fg-0 focus-visible:border-accent focus-visible:text-fg-0",
          "disabled:cursor-not-allowed disabled:opacity-40",
          open ? "border-accent text-fg-0" : "border-line text-fg-1",
          SIZES[size].trigger,
        )}
      >
        {trigger}
        <ChevronIcon className={cn("ml-auto transition-transform duration-[var(--dur-fast)]", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          style={{ width: menuWidth }}
          className={cn(
            "prism-rise absolute top-[calc(100%+6px)] z-40 flex min-w-full flex-col overflow-hidden",
            "rounded-lg border border-line bg-bg-1 shadow-[var(--shadow-pop)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {searchable ? (
            <div className="flex items-center gap-2 border-b border-line-subtle px-2.5 py-2">
              <SearchIcon />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={active ? optionId(active) : undefined}
                aria-label={`Filter ${label.toLowerCase()}`}
                value={search}
                placeholder={searchPlaceholder}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={onKeyDown}
                className="min-w-0 flex-1 bg-transparent text-sm text-fg-0 outline-none placeholder:text-fg-3"
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Clear filter"
                  onClick={() => {
                    setSearch("");
                    inputRef.current?.focus();
                  }}
                  className="cursor-pointer text-2xs text-fg-3 transition-colors duration-[var(--dur-fast)] hover:text-fg-1"
                >
                  clear
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            id={listId}
            role="listbox"
            aria-label={label}
            aria-multiselectable={multiple || undefined}
            className="max-h-[320px] overflow-y-auto py-1"
          >
            {navigable.length === 0 && visible.groups.length === 0 ? (
              <p className="px-3 py-5 text-center text-sm text-fg-3">{emptyText}</p>
            ) : null}

            {visible.flat.map((option) => renderRow(option, false))}

            {visible.groups.map((entry) => {
              const folded = isCollapsed(entry.group.key);
              return (
                <div key={entry.group.key} role="group" aria-label={entry.group.label}>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-expanded={!folded}
                    onClick={() => toggleGroup(entry.group.key)}
                    className={cn(
                      "sticky top-0 z-10 flex w-full cursor-pointer items-center gap-1.5 bg-bg-1 px-2 py-1.5",
                      "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-bg-2",
                    )}
                  >
                    <CaretIcon
                      className={cn("transition-transform duration-[var(--dur-fast)]", !folded && "rotate-90")}
                    />
                    {entry.group.accent ? <ToneDot color={entry.group.accent} /> : null}
                    <span className="truncate text-2xs font-semibold tracking-[0.12em] text-fg-2 uppercase">
                      {entry.group.label}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {groupAction?.(entry.group)}
                      <span className="tnum text-2xs text-fg-3">
                        {query ? entry.options.length : (entry.group.caption ?? entry.group.options.length)}
                      </span>
                    </span>
                  </button>
                  {folded ? null : entry.options.map((option) => renderRow(option, true))}
                </div>
              );
            })}
          </div>

          {footer ? <div className="border-t border-line-subtle px-2.5 py-1.5 text-2xs text-fg-3">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Case-insensitive match over everything an option carries as text. */
function matches<T extends string>(option: ComboboxOption<T>, query: string): boolean {
  if (!query) return true;
  return `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`.toLowerCase().includes(query);
}

/** Resolve a value to its option, plus the group it belongs to, if any. */
function findOption<T extends string>(
  options: readonly ComboboxOption<T>[],
  groups: readonly ComboboxGroup<T>[],
  value: T | undefined,
): { option: ComboboxOption<T>; group?: ComboboxGroup<T> } | undefined {
  if (value === undefined) return undefined;
  const flat = options.find((option) => option.value === value);
  if (flat) return { option: flat };
  for (const group of groups) {
    const found = group.options.find((option) => option.value === value);
    if (found) return { option: found, group };
  }
  return undefined;
}

/**
 * The row's selection mark.
 *
 * Multi-select shows an empty box on every row: the affordance has to say
 * "these accumulate" before anything is clicked, which a check that only
 * appears once selected cannot do.
 */
function RowMarker({ checked, multiple }: { checked: boolean; multiple: boolean }) {
  if (!multiple) {
    return <span className="flex size-3 shrink-0 items-center justify-center">{checked ? <CheckIcon /> : null}</span>;
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-3 shrink-0 items-center justify-center rounded-xs border",
        checked ? "border-accent bg-accent/15" : "border-line-strong",
      )}
    >
      {checked ? <CheckIcon /> : null}
    </span>
  );
}

function ToneDot({ color }: { color: string }) {
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />;
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={cn("size-3 shrink-0 text-fg-3", className)}>
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CaretIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={cn("size-2.5 shrink-0 text-fg-3", className)}>
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-3 shrink-0 text-fg-3">
      <circle cx="5.2" cy="5.2" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="m7.7 7.7 2.3 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-3 shrink-0 text-accent">
      <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
