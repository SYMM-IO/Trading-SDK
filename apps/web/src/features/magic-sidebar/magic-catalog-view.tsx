"use client";

import { SearchInput } from "@symmio/ui/components/search-input";
import { cn } from "@symmio/ui/lib/utils";
import { useMemo, useState } from "react";
import { MAGIC_CATALOG } from "./magic-catalog";
import { useMagicSidebar } from "./magic-sidebar-store";
import { MAGIC_GROUP_LABELS, MAGIC_GROUP_ORDER, type MagicMethod } from "./magic-types";
import { SourceBadge } from "./source-badge";

/** Searchable catalog of pinnable methods, grouped by source. */
export function MagicCatalogView() {
  const [term, setTerm] = useState("");
  const query = term.trim().toLowerCase();

  const grouped = useMemo(() => {
    const matches = MAGIC_CATALOG.filter(
      (method) =>
        !query ||
        `${method.label} ${method.description} ${method.group} ${method.keywords.join(" ")}`
          .toLowerCase()
          .includes(query),
    );
    return MAGIC_GROUP_ORDER.map((group) => ({
      group,
      items: matches.filter((method) => method.group === group),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col gap-5">
      <SearchInput
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search methods…"
        aria-label="Search magic methods"
        data-testid="magic-catalog-search"
      />

      {grouped.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No methods match <span className="text-foreground">“{term}”</span>.
        </p>
      ) : (
        grouped.map(({ group, items }) => (
          <section key={group} className="flex flex-col gap-2">
            <header className="flex items-center gap-3">
              <h3 className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                {MAGIC_GROUP_LABELS[group]}
              </h3>
              <span className="text-muted-foreground/60 font-mono text-[11px]">{items.length}</span>
              <span className="bg-border/60 h-px flex-1" aria-hidden />
            </header>
            <div className="flex flex-col gap-1.5">
              {items.map((method) => (
                <CatalogRow key={method.id} method={method} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function CatalogRow({ method }: { method: MagicMethod }) {
  const { isPinned, pin, unpin } = useMagicSidebar();
  const pinned = isPinned(method.id);

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        pinned ? "border-primary/30 bg-primary/[0.04]" : "border-border/70 hover:bg-muted/40",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">{method.label}</span>
          <SourceBadge source={method.source} />
        </div>
        <p className="text-muted-foreground/80 text-xs leading-5">{method.description}</p>
      </div>
      <button
        type="button"
        onClick={() => (pinned ? unpin(method.id) : pin(method.id))}
        aria-pressed={pinned}
        className={cn(
          "focus-visible:ring-ring/40 mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
          pinned
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted",
        )}
      >
        {pinned ? "Pinned" : "Add"}
      </button>
    </div>
  );
}
