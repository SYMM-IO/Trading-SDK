import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Input } from "./input";

export interface SearchInputProps extends React.ComponentProps<"input"> {
  /** Classes for the wrapping element — e.g. `flex-1` to grow inside a flex toolbar. */
  containerClassName?: string;
}

/**
 * A text {@link Input} with a leading search icon and matching left padding.
 * Forwards every native input prop (`value`, `onChange`, `placeholder`,
 * `aria-label`, `data-testid`, …) so it is a drop-in for a search field.
 *
 * @example
 * <SearchInput
 *   value={query}
 *   onChange={(event) => setQuery(event.target.value)}
 *   placeholder="Search…"
 *   aria-label="Search"
 *   containerClassName="flex-1"
 * />
 */
export function SearchInput({ className, containerClassName, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
        <Search className="size-4" />
      </span>
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}
