/**
 * Join class names, dropping falsy entries.
 *
 * Deliberately dependency-free — Prism keeps its install surface to the SDK
 * plus the framework, so there is no `clsx`/`tailwind-merge` here.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
