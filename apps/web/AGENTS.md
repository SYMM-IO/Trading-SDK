Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`apps/web` is the **production web app** — the spiritual successor to Vibe-ui, built on a modern stack. It is the first real consumer of the SDK and must use it the same way third-party developers will.

Stack: Next.js + React + Tailwind. Built against `@theoldvarorg/react` and `@theoldvarorg/ui`.

## Rules

- **Never import `@theoldvarorg/core` directly.** This is Hard Rule 6 in the root `AGENTS.md`. If you need a `core` API, expose it through `@theoldvarorg/react` first (as a hook or provider), then use it here. The package.json `dependencies` for this app must not list `@theoldvarorg/core`.
- **No SDK-shaped logic in app code.** If a piece of logic could be reused by another consumer (another app, a third-party integrator, a CLI), it belongs in `@theoldvarorg/core` or `@theoldvarorg/react`. Push it down before shipping it here.
- **App-specific composition only.** Routes, layouts, page-level wiring, app-only providers, environment binding, and browser-specific glue.
- **Design system usage.** Reusable visual primitives come from `@theoldvarorg/ui`. Do not re-implement a Button locally; if a primitive is missing, propose it in `@theoldvarorg/ui`.
- **Majors flows require approval.** Even at the app layer. See Hard Rule 7.

## Coding Style

- Follow repo-wide rules (kebab-case files, `function` keyword at module scope, `Props` naming).
- Page and layout files follow the Next.js conventions for the App Router (e.g. `page.tsx`, `layout.tsx`) — these are framework-imposed names and override the kebab-case rule for those specific files only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
