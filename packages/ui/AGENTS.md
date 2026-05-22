Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`@symm-frontier/ui` is the **design system** for this monorepo's own applications (`apps/web`, `apps/storybook`). It owns reusable UI primitives — buttons, inputs, modals, popovers, tooltips, tables, tabs, badges, layout primitives — and the design tokens that style them.

## Not Part of the SDK

This package is **not** part of the public SDK. Third-party consumers of `@symm-frontier/core` and `@symm-frontier/react` are not expected to depend on `@symm-frontier/ui` — they bring their own UI. Do not put SDK logic, domain types, or business rules in here.

## Rules

- **No SYMMIO business logic.** Components accept data and callbacks; they do not know about contracts, solvers, backends, or vendor APIs.
- **App-agnostic.** App-specific composition belongs in `apps/web`, not here.
- **No coupling to `@symm-frontier/core` or `@symm-frontier/react`.** This package must remain installable on its own.
- **Stories are colocated.** A primitive's `.stories.tsx` file lives next to its source (e.g. `src/button.tsx` ↔ `src/button.stories.tsx`).

## Coding Style

- Component files are kebab-case (`button.tsx`); the exported component is PascalCase (`Button`).
- Props interface is named `Props` when local to the file, `{ComponentName}Props` when exported.
- Follow the repo-wide `function`-keyword rule at module scope.
