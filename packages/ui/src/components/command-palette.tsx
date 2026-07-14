"use client";

import { Search } from "lucide-react";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import * as React from "react";
import { usePortalContainer } from "../lib/portal-container";
import { cn } from "../lib/utils";

/** A single selectable row in a {@link CommandPalette}. */
export interface CommandPaletteItem {
  /** Stable id, returned to {@link CommandPaletteProps.onSelect} and used for keys. */
  id: string;
  /** Rendered row content — compose icons, titles, and secondary text freely. */
  label: React.ReactNode;
  /** When true, the row is shown dimmed and skipped by keyboard navigation. */
  disabled?: boolean;
}

/** A titled section of {@link CommandPaletteItem}s. Empty groups are not rendered. */
export interface CommandPaletteGroup {
  /** Stable id for the section. */
  id: string;
  /** Optional section heading shown above its items. */
  heading?: React.ReactNode;
  items: CommandPaletteItem[];
}

export interface CommandPaletteProps {
  /** Whether the palette dialog is open. */
  open: boolean;
  /** Called when the dialog requests to open or close (overlay click, Escape). */
  onOpenChange: (open: boolean) => void;
  /** Current search text (controlled). */
  query: string;
  /** Called as the user types in the search field. */
  onQueryChange: (query: string) => void;
  /** Grouped result rows, already filtered and ordered by the caller. */
  groups: CommandPaletteGroup[];
  /** Called with an item id when a row is chosen by click or Enter. */
  onSelect: (id: string) => void;
  /** Accessible dialog title, visually hidden. Defaults to `"Search"`. */
  label?: string;
  /** Placeholder for the search field. */
  placeholder?: string;
  /** Rendered in the results area when every group is empty. */
  emptyState?: React.ReactNode;
  /** Optional footer strip, e.g. a key-hint legend. */
  footer?: React.ReactNode;
}

/**
 * A modal command palette: a search field over keyboard-navigable, grouped
 * result rows, built on Radix `Dialog`. The component owns the active-row state
 * and arrow/Home/End/Enter navigation; the caller owns filtering, ranking, and
 * grouping — pass already-ordered {@link CommandPaletteProps.groups} and handle
 * {@link CommandPaletteProps.onSelect}.
 *
 * @example
 * <CommandPalette
 *   open={open}
 *   onOpenChange={setOpen}
 *   query={query}
 *   onQueryChange={setQuery}
 *   groups={[{ id: "pages", heading: "Pages", items: [{ id: "home", label: "Overview" }] }]}
 *   onSelect={(id) => router.push(hrefFor(id))}
 *   placeholder="Search pages, methods, markets…"
 * />
 */
export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  onSelect,
  label = "Search",
  placeholder = "Search…",
  emptyState,
  footer,
}: CommandPaletteProps) {
  const flat = React.useMemo(() => groups.flatMap((group) => group.items.filter((item) => !item.disabled)), [groups]);
  const [activeId, setActiveId] = React.useState<string | undefined>(flat[0]?.id);
  const listRef = React.useRef<HTMLDivElement>(null);

  /** Keep the active row valid as results change while typing. */
  React.useEffect(() => {
    setActiveId((current) => (current && flat.some((item) => item.id === current) ? current : flat[0]?.id));
  }, [flat]);

  /** Scroll the active row into view as it moves. */
  React.useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector(`[data-command-item="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function moveActive(delta: number) {
    if (flat.length === 0) return;
    const index = flat.findIndex((item) => item.id === activeId);
    const next = (index + delta + flat.length) % flat.length;
    setActiveId(flat[next]?.id);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveId(flat[0]?.id);
        break;
      case "End":
        event.preventDefault();
        setActiveId(flat.at(-1)?.id);
        break;
      case "Enter":
        if (activeId) {
          event.preventDefault();
          onSelect(activeId);
        }
        break;
      default:
        break;
    }
  }

  const hasResults = flat.length > 0;
  const container = usePortalContainer();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={handleKeyDown}
          className="bg-card/90 text-card-foreground border-border/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 fixed top-[10vh] left-1/2 z-50 flex max-h-[74vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border shadow-2xl backdrop-blur-2xl ease-[cubic-bezier(0.16,1,0.3,1)]"
        >
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>{label}</DialogPrimitive.Title>
          </VisuallyHidden.Root>

          <div className="border-border/60 flex items-center gap-3 border-b px-4">
            <Search className="text-muted-foreground size-[18px] shrink-0" aria-hidden />
            <input
              autoFocus
              type="text"
              role="combobox"
              aria-expanded={hasResults}
              aria-controls="command-palette-list"
              aria-activedescendant={activeId ? `command-item-${activeId}` : undefined}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={placeholder}
              className="text-foreground placeholder:text-muted-foreground h-12 w-full bg-transparent text-[0.95rem] outline-none"
            />
          </div>

          <div
            ref={listRef}
            id="command-palette-list"
            role="listbox"
            aria-label={label}
            className="flex-1 overflow-y-auto overscroll-contain p-2"
          >
            {hasResults ? (
              groups
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.id} className="mb-1 last:mb-0">
                    {group.heading ? (
                      <div className="text-muted-foreground px-2 pt-2 pb-1 text-[0.7rem] font-medium tracking-[0.14em] uppercase">
                        {group.heading}
                      </div>
                    ) : null}
                    {group.items.map((item) => {
                      const active = item.id === activeId;
                      return (
                        <div
                          key={item.id}
                          id={`command-item-${item.id}`}
                          data-command-item={item.id}
                          role="option"
                          aria-selected={active}
                          aria-disabled={item.disabled || undefined}
                          onPointerMove={() => !item.disabled && setActiveId(item.id)}
                          onClick={() => !item.disabled && onSelect(item.id)}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                            active ? "bg-muted text-foreground" : "text-muted-foreground",
                            item.disabled && "pointer-events-none opacity-50",
                          )}
                        >
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                ))
            ) : (
              <div className="text-muted-foreground px-3 py-10 text-center text-sm">{emptyState ?? "No results."}</div>
            )}
          </div>

          {footer ? (
            <div className="border-border/60 text-muted-foreground border-t px-4 py-2.5 text-xs">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
