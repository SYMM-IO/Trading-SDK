"use client";

import { Input } from "@symmio/ui/components/input";
import { Label } from "@symmio/ui/components/label";
import { cn } from "@symmio/ui/lib/utils";
import type { ComponentProps, ReactNode } from "react";

interface FieldProps extends Omit<ComponentProps<typeof Input>, "id"> {
  /** Visible field label, wired to the input via `htmlFor`. */
  label: string;
  /** Input id — required so the label and hint associate for assistive tech. */
  id: string;
  /** Helper text shown when there is no error. */
  hint?: ReactNode;
  /** Validation message; when set, the field renders in its invalid state. */
  error?: string;
  /** Optional trailing content inside the field (e.g. a `%` sign or unit). */
  adornment?: ReactNode;
  /** Optional control shown on the label row, right-aligned (e.g. "Use wallet"). */
  labelAction?: ReactNode;
}

/**
 * A labeled text field: label row (with an optional right-aligned action), the
 * input, and a single line of hint-or-error beneath it. The workhorse control
 * for the registration form, so every field lines up and reports errors the
 * same way.
 */
export function Field({ label, id, hint, error, adornment, labelAction, className, ...input }: FieldProps) {
  const describedBy = `${id}-note`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? describedBy : undefined}
          className={cn("font-mono", adornment && "pr-9", className)}
          {...input}
        />
        {adornment ? (
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
            {adornment}
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={describedBy} className="text-destructive text-xs leading-5">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-muted-foreground text-xs leading-5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
