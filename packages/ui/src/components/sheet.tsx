import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Root of a slide-in panel anchored to a screen edge, built on Radix `Dialog`.
 * Compose with {@link SheetTrigger}, {@link SheetContent}, {@link SheetHeader},
 * {@link SheetFooter}, {@link SheetTitle}, and {@link SheetDescription}.
 *
 * @example
 * <Sheet open={open} onOpenChange={setOpen}>
 *   <SheetContent side="right">
 *     <SheetHeader>
 *       <SheetTitle>Settings</SheetTitle>
 *     </SheetHeader>
 *   </SheetContent>
 * </Sheet>
 */
function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

/** The control that opens the {@link Sheet}. Pass `asChild` to use a custom element. */
function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

/** A control that closes the {@link Sheet} from within its content. */
function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/** The dimmed, blurred backdrop behind {@link SheetContent}. Rendered automatically. */
function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/45 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  "bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-0 shadow-xl ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        right:
          "border-border/70 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-full border-l sm:max-w-lg",
        left: "border-border/70 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-full border-r sm:max-w-lg",
        top: "border-border/70 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
        bottom:
          "border-border/70 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

/**
 * The sliding panel surface. Renders the overlay and a built-in close button, and
 * portals to the document body.
 *
 * @param side - Screen edge the panel anchors to. Defaults to `"right"`.
 * @param showClose - Render the built-in top-right close button. Defaults to `true`.
 */
function SheetContent({
  className,
  children,
  side = "right",
  showClose = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetVariants> & {
    showClose?: boolean;
  }) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetOverlay />
      <SheetPrimitive.Content data-slot="sheet-content" className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {showClose ? (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none"
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

/** Sticky-friendly header region for a {@link SheetContent}. */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

/** Footer region for a {@link SheetContent}, typically holding primary actions. */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-6", className)} {...props} />;
}

/** Accessible title for the {@link Sheet}. Required for screen-reader labelling. */
function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-display text-lg leading-tight font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

/** Supporting description text for the {@link Sheet}, linked for assistive tech. */
function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm leading-5", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  SheetTrigger,
};
