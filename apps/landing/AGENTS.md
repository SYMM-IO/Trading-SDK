Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`apps/landing` is the **marketing landing page** for the SYMMIO Trading-SDK workspace. It introduces the SDK and the apps built on it, and routes visitors to the docs, the web console, Storybook, and GitHub.

Stack: Next.js + React + Tailwind, built against `@symmio/ui` for tokens and primitives, with `motion` for animation. It mirrors `apps/web`'s stack and theme so the surfaces feel like one product.

## Rules

- **Presentational by default; live only on `/affiliate`.** Every page except the affiliate registration route is presentational — no wallet, no SDK runtime, no data client — and the hero trading panel is a deliberate mock. The one exception is `src/app/affiliate` (the SYMMIO Affiliate Program page), which is genuinely wallet-connected: it wraps `@symmio/trading-core` + `@symmio/trading-react` in `src/features/affiliate/affiliate-providers.tsx` (wagmi + React Query + `SymmioProvider`). Those providers are **route-scoped** — mounted inside the affiliate page, never in the global `app/providers.tsx` — so the marketing home never loads the wallet stack. If you add another live surface, scope its providers the same way; do not lift the SDK into the global layout.
- **Where the SDK config lives.** `src/config/wagmi.ts` and `src/config/symmio.ts` hold the affiliate route's chain + provider config. `symmio.ts`'s `affiliatesAddress` only satisfies `SymmioProvider`'s non-zero requirement; the registration flow itself does not read it.
- **Inherit the theme; never fork it.** Colors, fonts, radius, shadows, and the atmosphere come from `@symmio/ui/globals.css`. Do not hardcode hex values that duplicate design tokens — use the `--*` variables and Tailwind token classes so the palette stays identical to the console. The only literal colors allowed are values a non-CSS runtime needs (the `canvas-confetti` particle palette in `features/affiliate/celebration.tsx`) and on-chain data defaults the user edits (the default `brandColor` in the registration form) — never for styling a DOM element.
- **Design system usage.** Reusable visual primitives (Button, CopyButton, etc.) come from `@symmio/ui`. Compose them; do not re-implement them here.
- **Keep outbound links central.** All external URLs live in `src/lib/site.ts`. Update them there, not inline.

## Coding Style

- Follow repo-wide rules (kebab-case files, `function` keyword at module scope, `Props` naming).
- Page and layout files follow Next.js App Router conventions (`page.tsx`, `layout.tsx`); those framework-imposed names override the kebab-case rule for those files only.
- Keep `"use client"` boundaries tight — mark only the components that actually use `motion`, theme state, or browser APIs.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
