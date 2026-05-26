import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge an arbitrary list of class names while collapsing conflicting Tailwind
 * utilities to the last-wins variant.
 *
 * Use this for any class composition in a UI primitive — never concatenate
 * Tailwind classes by hand or with raw template strings, because conflicting
 * utilities (e.g. `px-2` and `px-4`) need `tailwind-merge` to resolve sanely.
 *
 * @example
 * cn("px-2", condition && "px-4", "text-sm");
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
