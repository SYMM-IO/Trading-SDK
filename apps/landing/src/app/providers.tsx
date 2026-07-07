"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * App-wide providers for the landing site. The page is purely presentational —
 * no wallet, no SDK runtime, no data client — so this is just the theme bridge.
 * Matches `apps/web` exactly: class-based theming that follows the system
 * preference by default, with the cross-fade disabled so toggling never flashes.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
