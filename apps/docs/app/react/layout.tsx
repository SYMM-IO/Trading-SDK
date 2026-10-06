import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Suffix every page under `/react/` with its package name, so a search result
 * says which package it documents and same-named pages in other sections never
 * collide. Templates only reach child segments, so the section's own overview
 * keeps the root template; `default` has that template applied, hence bare.
 */
export const metadata: Metadata = {
  title: { default: "@symmio/trading-react", template: "%s · @symmio/trading-react" },
};

/** Pass-through layout — it exists only to scope the title template above. */
export default function ReactLayout({ children }: { children: ReactNode }) {
  return children;
}
