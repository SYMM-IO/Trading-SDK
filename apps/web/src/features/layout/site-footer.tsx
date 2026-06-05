import { StatusDot } from "@/components/status-dot";
import { LogoMark } from "@/features/layout/logo";
import { navLinks } from "@/features/layout/nav";
import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-border/60 mt-24 border-t">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-sm flex-col gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark className="size-8 rounded-lg" />
              <span className="font-display text-foreground text-base font-semibold tracking-tight">
                Symmio Frontier
              </span>
            </Link>
            <p className="text-muted-foreground text-sm leading-6">
              The VibeCaps SDK surface for SYMMIO — connect a wallet, inspect contract state, and trade on HyperEVM.
            </p>
            <span className="border-border/70 bg-muted/40 text-muted-foreground inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium">
              <StatusDot tone="positive" pulse />
              HyperEVM · Live
            </span>
          </div>

          <nav className="flex flex-col gap-3">
            <span className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">Navigate</span>
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground w-fit text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="border-border/60 text-muted-foreground mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} Symmio Frontier</span>
          <span className="font-mono">
            built with <span className="text-foreground">@symm-frontier</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
