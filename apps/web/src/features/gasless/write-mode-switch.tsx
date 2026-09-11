"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";

/** Tint of a switched-on control: the relay reads as `info`, the session key as `primary`. */
const CHECKED_TONES = {
  info: "border-info/40 bg-info/10 text-info",
  primary: "border-primary/40 bg-primary/10 text-primary",
} as const;

interface Props {
  /** Accessible name: what the switch controls, and for which method. */
  label: string;
  /** Hover and keyboard-focus explanation of the current state and what a click does. */
  tooltip: ReactNode;
  checked: boolean;
  /** Omitted for a blocked switch, which never changes. */
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Renders the switch inert. It stays focusable (`aria-disabled`, not
   * `disabled`) so keyboard and pointer users can still reach the tooltip that
   * says why.
   */
  blocked?: boolean;
  tone: keyof typeof CHECKED_TONES;
  /** Corner dot marking a card that overrides the app-wide default. */
  marker?: boolean;
  testId: string;
  /** The icon, drawn by the caller for the current state. */
  children: ReactNode;
}

/**
 * The compact icon switch a write card's header controls are drawn with — the
 * gasless relay and the session key — so the pair stays visually locked
 * together and reads as one cluster beside the `write` chip.
 */
export function WriteModeSwitch({
  label,
  tooltip,
  checked,
  onCheckedChange,
  blocked = false,
  tone,
  marker = false,
  testId,
  children,
}: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-disabled={blocked}
          aria-label={label}
          data-testid={testId}
          onClick={blocked ? undefined : () => onCheckedChange?.(!checked)}
          className={cn(
            "focus-visible:ring-ring/40 relative inline-flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors outline-none focus-visible:ring-2",
            blocked
              ? "border-border/70 text-muted-foreground/50 cursor-not-allowed"
              : checked
                ? CHECKED_TONES[tone]
                : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {children}
          {marker ? (
            <span
              className="bg-primary ring-card absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-2"
              aria-hidden
            />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
