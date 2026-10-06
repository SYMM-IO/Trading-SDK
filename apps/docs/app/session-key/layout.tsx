import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Suffix every page under `/session-key/` with its package name, so a search result
 * says which package it documents and same-named pages in other sections never
 * collide. Templates only reach child segments, so the section's own overview
 * keeps the root template; `default` has that template applied, hence bare.
 */
export const metadata: Metadata = {
  title: { default: "@symmio/session-key", template: "%s · @symmio/session-key" },
};

/** Pass-through layout — it exists only to scope the title template above. */
export default function SessionKeyLayout({ children }: { children: ReactNode }) {
  return children;
}
