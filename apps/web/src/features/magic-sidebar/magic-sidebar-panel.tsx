"use client";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@symm-frontier/ui/components/sheet";
import { cn } from "@symm-frontier/ui/lib/utils";
import { MagicBoardView } from "./magic-board-view";
import { MagicCatalogView } from "./magic-catalog-view";
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, useMagicSidebar } from "./magic-sidebar-store";
import { SidebarResizeHandle } from "./sidebar-resize-handle";
import { useSidebarMetrics } from "./use-sidebar-metrics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Right-docked, non-blocking "magic" sidebar: a live board of pinned SDK methods
 * plus a searchable catalog to add more. Each pinned method polls (and is
 * socket-ready) and shows its latest response with prior responses as stale
 * history. The page behind stays fully interactive while it runs.
 */
export function MagicSidebarPanel({ open, onOpenChange }: Props) {
  const { view, setView, pins, width, setWidth, setIsResizing } = useMagicSidebar();
  const { panelMaxWidth } = useSidebarMetrics();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        keepMounted
        showOverlay={false}
        inert={!open}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="w-full gap-0 p-0 shadow-2xl"
        style={{ maxWidth: panelMaxWidth }}
      >
        <SidebarResizeHandle
          width={width}
          minWidth={MIN_SIDEBAR_WIDTH}
          maxWidth={MAX_SIDEBAR_WIDTH}
          onResize={setWidth}
          onResizeStart={() => setIsResizing(true)}
          onResizeEnd={() => setIsResizing(false)}
        />
        <header className="border-border/70 relative shrink-0 overflow-hidden border-b px-6 pt-6 pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-28 h-44 opacity-80"
            style={{
              background:
                "radial-gradient(34rem 14rem at 78% 0%, color-mix(in oklab, var(--primary) 24%, transparent), transparent 70%)",
            }}
          />
          <div className="relative flex flex-col gap-3">
            <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] uppercase">
              <span className="text-primary">SDK</span>
              <span className="text-border">/</span>
              <span>Live board</span>
            </div>
            <SheetTitle>Magic sidebar</SheetTitle>
            <SheetDescription>
              Pin SDK methods and watch them poll live. Each new response is shown on top; when it changes, the previous
              one is kept below as stale history.
            </SheetDescription>

            <div className="border-border/70 bg-muted/30 mt-1 inline-flex w-fit gap-1 rounded-xl border p-1">
              <ViewTab label="Board" count={pins.length} active={view === "board"} onClick={() => setView("board")} />
              <ViewTab label="Add methods" active={view === "catalog"} onClick={() => setView("catalog")} />
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {/* Both views stay mounted so pinned cards keep their inputs and keep
              polling/streaming while you browse the catalog; only display toggles. */}
          <div className={cn(view !== "board" && "hidden")}>
            <MagicBoardView />
          </div>
          <div className={cn(view !== "catalog" && "hidden")}>
            <MagicCatalogView />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ViewTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-ring/40 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-px font-mono text-[10px]",
            active ? "bg-primary/15 text-primary" : "bg-muted-foreground/15 text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
