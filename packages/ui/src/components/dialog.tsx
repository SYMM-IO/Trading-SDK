import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Root of a modal dialog, built on Radix `Dialog`. Compose with
 * {@link DialogTrigger} and {@link DialogContent}; supply a {@link DialogTitle}
 * inside the content for accessibility. Unlike {@link Popover} it is modal —
 * it traps focus, blocks the page behind a backdrop, and dismisses on Escape or
 * outside click.
 *
 * @example
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <DialogTrigger asChild>
 *     <Button>Open</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Title</DialogTitle>
 *       <DialogDescription>Supporting copy.</DialogDescription>
 *     </DialogHeader>
 *     …
 *   </DialogContent>
 * </Dialog>
 */
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/** The control that opens the {@link Dialog}. Pass `asChild` to use a custom element. */
function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** Closes the nearest {@link Dialog}. Pass `asChild` to wrap a custom control. */
function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/** The dimmed, blurred backdrop behind {@link DialogContent}. Rendered automatically by it. */
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/45 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The floating dialog surface. Portaled to the body, centered in the viewport,
 * and animated on open/close. Renders its own {@link DialogOverlay} and a
 * top-right close button.
 *
 * @param showClose - Render the built-in close button. Defaults to `true`.
 */
function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            "bg-popover text-popover-foreground border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative my-auto w-full max-w-lg rounded-2xl border p-6 shadow-2xl duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none",
            className,
          )}
          {...props}
        >
          {children}
          {showClose ? (
            <DialogPrimitive.Close
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

/** Stacks a {@link DialogTitle} and {@link DialogDescription} at the top of {@link DialogContent}. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

/** A bottom action row for {@link DialogContent}; stacks on mobile, right-aligns on desktop. */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

/** The dialog's accessible title. Required by Radix unless visually hidden elsewhere. */
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-display text-lg leading-tight font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

/** Secondary copy under the {@link DialogTitle}. */
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
