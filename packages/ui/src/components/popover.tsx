import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";

import { usePortalContainer } from "../lib/portal-container";
import { cn } from "../lib/utils";

/**
 * Root of a floating panel anchored to a trigger, built on Radix `Popover`.
 * Compose with {@link PopoverTrigger} (or {@link PopoverAnchor}) and
 * {@link PopoverContent}. Unlike a dialog it is non-modal by default, so it
 * suits inline affordances such as comboboxes and pickers.
 *
 * @example
 * <Popover open={open} onOpenChange={setOpen}>
 *   <PopoverTrigger asChild>
 *     <Button variant="outline">Open</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>…</PopoverContent>
 * </Popover>
 */
function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

/** The control that toggles the {@link Popover}. Pass `asChild` to use a custom element. */
function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * Positions {@link PopoverContent} relative to an element other than the
 * trigger — wrap a field in it so the panel matches the field's width and edge.
 */
function PopoverAnchor(props: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

/**
 * The floating surface. Portaled to the body and animated on open/close.
 *
 * @param align - Alignment against the anchor edge. Defaults to `"center"`.
 * @param sideOffset - Gap in pixels between the anchor and the panel. Defaults to `6`.
 */
function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Portal container={container ?? undefined}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 border-border z-50 origin-(--radix-popover-content-transform-origin) rounded-xl border p-4 shadow-lg outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
