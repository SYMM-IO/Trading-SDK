Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`@symm-frontier/react` is the **React layer on top of `@symm-frontier/core`**. It exposes hooks, providers, and any flow that needs framework state (React context, lifecycle, suspense) and cannot live in `core`.

What this package owns:

- React hooks that wrap `core` services and state machines.
- Providers (e.g. SDK provider, query/cache providers) needed to use the hooks.
- React-specific ergonomics around `core` types (selectors, derived hooks, suspense boundaries).
- JSDoc-quality documentation for every public export.

What this package does **not** own:

- Contract calls, API/GraphQL clients, transformations, calculations. Those live in `core`.
- Design system components (Button, Modal, etc.). Those live in `@symm-frontier/ui`.
- Product screens or routes. Those live in `apps/web`.

## Current State

The contents on disk are **throwaway scaffolding** carried over from a prior `packages/core` → `packages/react` rename. Do not invest in the current files. Once `packages/core` exists and a Design Proposal is approved, this package is rebuilt from scratch as a thin React layer on top of `core`.

Until then, treat any change here that goes beyond removing scaffolding as **non-trivial** and subject to the [Design Proposal Gate](../../AGENTS.md#design-proposal-gate).

## Public API

- Public entry is `src/index.ts`. Sub-entries (e.g. `./provider`, `./wallet`) are allowed when they make tree-shaking or grouping clearer; declare them in `package.json` `exports`.
- Every export must have JSDoc (purpose, params, return, short usage example for non-obvious APIs).
- Re-exporting types from `core` is fine; re-exporting whole `core` runtime modules is **not** — consumers that want raw `core` should depend on `core` directly. `react` exposes React-shaped APIs.

## Rules

- **Depend on `@symm-frontier/core`.** Do not duplicate `core` logic here. If you find yourself implementing a contract call or a calculation in `react`, stop — it belongs in `core`.
- **Peer-depend on React.** React is a `peerDependency`, not a direct dep, so consumers' React version wins.
- **No app-level globals.** No module-level mutable singletons, no calls that assume a specific provider mounted outside what this package itself sets up.
- **Hooks are framework-bound by definition.** That is the reason for this package's existence. Use them.

## Coding Style

- Hooks are named `useXxx` and live in files named `use-xxx.ts`.
- Providers are named `XxxProvider` and live in files named `xxx-provider.tsx`.
- Follow the repo-wide rules on kebab-case filenames, `function`-keyword declarations, and `Props` naming.
