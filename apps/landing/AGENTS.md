Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`apps/landing` is the **marketing landing page** for the SYMMIO Trading-SDK workspace. It introduces the SDK and the apps built on it, and routes visitors to the docs, the web console, Storybook, and GitHub.

Stack: Next.js + React + Tailwind, built against `@symmio/ui` for tokens and primitives, with `motion` for animation. It mirrors `apps/web`'s stack and theme so the surfaces feel like one product.

## Rules

- **Presentational only.** No wallet, no SDK runtime, no data client. Do not add `@symmio/trading-core` or `@symmio/trading-react` as dependencies — the page links out to the console and docs rather than embedding live SDK calls. The hero trading panel is a deliberate mock.
- **Inherit the theme; never fork it.** Colors, fonts, radius, shadows, and the atmosphere come from `@symmio/ui/globals.css`. Do not hardcode hex values that duplicate design tokens — use the `--*` variables and Tailwind token classes so the palette stays identical to the console.
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
