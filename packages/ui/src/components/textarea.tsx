import * as React from "react";

import { cn } from "../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "bg-input/40 border-border placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:bg-input/60 aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:ring-destructive/25 dark:aria-invalid:bg-destructive/10 dark:aria-invalid:ring-destructive/35 field-sizing-content min-h-16 w-full min-w-0 rounded-md border px-3 py-2 text-base transition-[color,box-shadow,background-color,border-color] outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
