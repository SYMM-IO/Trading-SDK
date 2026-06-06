import * as React from "react";

import { cn } from "../lib/utils";
import { Badge } from "./badge";

export interface SuggestionListProps extends React.ComponentProps<"div"> {
  label?: React.ReactNode;
  layout?: "wrap" | "stack";
}

function SuggestionList({
  label = "Suggestions",
  layout = "wrap",
  className,
  children,
  ...props
}: SuggestionListProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {label ? (
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
      ) : null}
      <div className={cn(layout === "stack" ? "grid gap-2" : "flex flex-wrap gap-2")}>{children}</div>
    </div>
  );
}

export interface SuggestionListItemProps extends Omit<React.ComponentProps<"button">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  selected?: boolean;
  selectedLabel?: React.ReactNode;
  actionLabel?: React.ReactNode;
}

function SuggestionListItem({
  title,
  description,
  meta,
  selected = false,
  selectedLabel = "Selected",
  actionLabel,
  className,
  children,
  ...props
}: SuggestionListItemProps) {
  const isDetailed = Boolean(description);

  return (
    <button
      type="button"
      className={cn(
        "border-border bg-background hover:bg-muted/50 focus-visible:ring-ring disabled:bg-muted/20 disabled:text-muted-foreground disabled:hover:bg-muted/20 rounded-md border text-left text-xs transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
        isDetailed
          ? "flex items-center justify-between gap-3 px-3 py-2"
          : "inline-flex items-center gap-2 px-2.5 py-1.5",
        className,
      )}
      {...props}
    >
      <span className={cn(isDetailed ? "min-w-0" : "contents")}>
        <span className={cn(isDetailed ? "text-foreground block text-sm font-medium" : "font-medium")}>{title}</span>
        {description ? <span className="text-muted-foreground mt-0.5 block">{description}</span> : null}
        {meta ? (
          <span className={cn("text-muted-foreground font-mono", isDetailed ? "mt-1 block" : undefined)}>{meta}</span>
        ) : null}
      </span>
      {children}
      {selected ? (
        <Badge variant="positive">{selectedLabel}</Badge>
      ) : actionLabel ? (
        <Badge variant="secondary">{actionLabel}</Badge>
      ) : null}
    </button>
  );
}

export { SuggestionList, SuggestionListItem };
