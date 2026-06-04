import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Indeterminate loading spinner. Inherits `currentColor`; size via className
 * (`size-4` default). Carries `role="status"` so screen readers announce it.
 *
 * @example
 * <Spinner className="size-5 text-primary" />
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn("size-4 shrink-0 animate-spin", className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export { Spinner };
