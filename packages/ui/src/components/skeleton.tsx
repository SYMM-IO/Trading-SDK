import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Low-emphasis placeholder for content that is still loading. Pulses gently;
 * size and shape are set by className.
 *
 * @example
 * <Skeleton className="h-4 w-32" />
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted/70 animate-pulse rounded-md motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
