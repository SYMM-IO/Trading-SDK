import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { usePortalContainer } from "../lib/portal-container";
import { cn } from "../lib/utils";

/**
 * Wraps Radix's tooltip `Provider`. {@link Tooltip} already includes one, so you
 * only need this directly to share a single `delayDuration` across many tooltips.
 */
function TooltipProvider({ delayDuration = 200, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />;
}

/**
 * A hover/focus tooltip, built on Radix `Tooltip`. Self-contained — it brings its
 * own provider, so no app-level provider is required. Compose with
 * {@link TooltipTrigger} and {@link TooltipContent}.
 *
 * @example
 * <Tooltip>
 *   <TooltipTrigger asChild><button aria-label="Help">?</button></TooltipTrigger>
 *   <TooltipContent>Explains the thing.</TooltipContent>
 * </Tooltip>
 */
function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

/** The element that opens the {@link Tooltip} on hover or keyboard focus. Use `asChild` to wrap your own control. */
function TooltipTrigger({ onFocus, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
      onFocus={(event) => {
        onFocus?.(event);
        /**
         * Radix opens on *any* focus, including programmatic focus. Popovers and
         * dialogs auto-focus their first tabbable child on open, so a trigger
         * sitting there would show its tooltip unprompted. Keep tooltips for real
         * keyboard focus only — Radix skips its own handler once default is
         * prevented.
         */
        if (!event.defaultPrevented && !event.currentTarget.matches(":focus-visible")) event.preventDefault();
      }}
    />
  );
}

/** The floating tooltip bubble. Portaled to the body. */
function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const container = usePortalContainer();
  return (
    <TooltipPrimitive.Portal container={container ?? undefined}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover/85 text-popover-foreground border-border data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95 z-50 w-fit rounded-md border px-3 py-1.5 text-xs leading-snug shadow-md backdrop-blur-xl",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-popover z-50 size-2.5 translate-y-[calc(-50%_-_1px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
