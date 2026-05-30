import { ThemeToggle } from "@/features/layout/theme-toggle";
import Link from "next/link";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/inspector/account-layer", label: "AccountLayer" },
  { href: "/inspector/markets", label: "Markets" },
  { href: "/config", label: "Config" },
];

export function SiteHeader() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight">Symmio</span>
          <span className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Frontier</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full px-3 py-1.5 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
