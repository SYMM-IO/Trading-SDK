# SYMM Frontier Agent Guide

This file is the working agreement for AI coding agents (Claude, Codex) contributing to this repository. Read it fully before taking any action.

## Hard Rules

These are non-negotiable. Violating any of them is a defect.

1. Use **pnpm**. Never run `yarn` or `npm install` in this repo.
2. **Vibe-ui is read-only reference.** Never edit, create, or delete files in the vibe-ui repo.
3. **Current phase is VibeCaps only.** Do not implement Majors trading logic. If a task seems to require it, stop and ask.
4. **Output a design proposal and wait for human approval before writing implementation code.** See "Design Proposal Gate" below. The only exceptions are listed there.
5. When scope, package placement, or intent is unclear, **stop and ask the user.** Do not guess.
6. Do not add new dependencies without a stated reason and user approval.

## Project Vocabulary

- **frontier project**: this repository.
- **vibe-ui repo**: the separate Vibe UI reference application. Its local path can differ by machine; ask the user or use the path they provide in the current task.
- **SYMMIO SDK / core SDK**: the clean, reusable domain layer being built in `packages/core`.

When a task references "current repo", it means the frontier project unless the user explicitly says otherwise.

## Goal

Frontier is a clean frontend boundary for SYMMIO trading flows:

- shared domain logic, SDK APIs, and React SDK hooks/providers in `packages/core`;
- shared design system and reusable UI primitives in `packages/ui`;
- application screens and product composition in `apps/web`;
- documentation in `apps/docs`;
- component previews in `apps/storybook`;
- shared tooling only in `packages/eslint-config` and `packages/typescript-config`.

The long-term product goal is to offer simple interfaces over complex SYMMIO flows. A user should eventually be able to provide a small set of parameters and perform high-level actions such as buying a token, while the SDK handles account, quote, solver, contract, backend, inventory, and transaction details underneath.

Frontier is **not** a rewrite of vibe-ui's UI. It is an SDK-first extraction of SYMMIO trading capability, with UI built on top. Every implementation should make that boundary sharper.

## Current Phase Scope

The current phase is focused on **VibeCaps** logic and UI only.

- Work on lowcap/VibeCaps trading flows, services, SDK APIs, and UI.
- Do not migrate Majors trading logic into frontier in this phase.
- Use Majors code in vibe-ui only as background reference when it clarifies shared concepts.
- If a task appears to require Majors behavior, stop and confirm scope with the user before implementing.

## Vibe-UI Reference Summary

The vibe-ui repo is the production reference implementation: a large Next.js Pages Router trading app for a permissionless, intent-based perpetual DEX.

Stack: Next.js 16, React 19, TypeScript 5, Yarn 4. State via Zustand. Integrations include wallets, Privy, Wagmi, Viem, Ethers, Solana/Anchor, Pimlico, Apollo subgraphs, backend APIs, solver/hedger APIs, CCTP, Binance, Dexscreener, TradingView, Sentry, PostHog, OneSignal, GA, Hotjar.

Main routes: `/majors`, `/majors/[symbolId]`, `/vibecaps`, `/vibecaps/[symbol]`, `/account`, `/points`, `/pools`, `/contest`.

Domain logic lives across `src/services`, `src/callbacks`, `src/stores`, `src/checker`, `src/context`, `src/hooks`, constants, and UI components.

**How to navigate vibe-ui for a given flow:**

1. Start at the route or component the user mentions (e.g. `/vibecaps/[symbol]`).
2. Follow imports into `src/callbacks` and `src/services` to find the flow's domain logic.
3. Check `src/stores` for relevant Zustand state and `src/checker` for background sync.
4. Identify external dependencies (backend, solver, contract, subgraph) at the leaves.

Vibe-ui is a source of behavioral truth, not a structure to copy wholesale. Extract intent and domain logic; do not mirror the file layout.

## Folder Responsibilities

### `packages/core`

Put SDK, domain logic, and React SDK adapters here.

Examples: SYMMIO client creation and config; typed service clients for backend, solver/hedger, subgraph, inventory, price, and account APIs; contract adapters and transaction builders; trade flows (quote, buy/sell/open/close, TP/SL, cancel, force close, withdrawal/deposit, account management); domain types, schemas, errors, validation, serialization, pure calculation utilities; React hooks/providers for SDK consumers; public SDK entry points.

Recommended starting structure:

```txt
packages/core/src/
  provider/       # SymmioProvider, SDK context, provider-level hooks
  config/         # SDK config types, defaults, validation, environment binding helpers
  wallet/         # Wagmi-backed account, signing, transaction, and chain hooks
  markets/        # VibeCaps market list/detail services and hooks
  prices/         # price services, subscriptions, polling, and hooks
  trading/        # buy/open/close flows, quote lifecycle hooks, trade types
  withdraw/       # withdraw flows, withdraw hooks, request/response types
  accounts/       # account/subaccount hooks, services, and types
  contracts/      # ABI modules, contract adapters, transaction builders
  services/       # shared low-level backend, solver, subgraph, inventory clients
  errors/         # typed SDK errors
  utils/          # shared helpers and calculations
  index.ts        # public exports
```

This structure is not fixed. Add, remove, rename, or merge folders when the implementation has a clear domain reason. Include those changes in the design proposal before implementation.

Rules:

- Do not import UI libraries or app components into `packages/core`.
- Organize by domain and responsibility, not by technology. For example, wallet hooks belong in `wallet/`, withdraw hooks belong in `withdraw/`, and provider code belongs in `provider/`.
- Do not use browser globals (`window`, `document`, `localStorage`, `navigator`, etc.) casually. If needed, keep them inside the domain module that owns that browser behavior.
- Keep public APIs small, typed, and stable.
- Use pure functions and explicit dependency injection. Do not introduce module-level mutable state or hidden globals.
- Validate external data at the boundary (responses from backend, solver, subgraph).
- Design for the current React SDK needs first. Do not add abstraction solely for possible pure JS extraction unless the user asks for that direction.

### `packages/ui`

Put the design system and reusable UI primitives here.

Examples: Button, input, modal, popover, tooltip, table, tabs, switch, badge, typography, layout primitives; design tokens, CSS variables, reusable styles.

Rules:

- Do not put SYMMIO business logic here.
- Components accept data and callbacks; they do not know about solver/backend/contract details.
- Components must be app-agnostic. App-specific composition belongs in `apps/web`.

### `apps/web`

Put the Frontier product app here.

Examples: routes, pages, app-level layouts; composition of `packages/core` and `packages/ui`; feature screens and browser-specific integration; app-specific providers and environment binding.

Rules:

- Do not bury reusable SDK logic inside app components. If logic could be reused by another app or script, it belongs in `packages/core`.
- When working on Next.js features, consult the official Next.js docs at https://nextjs.org/docs via web fetch.

### `apps/docs`

Human-facing documentation, built with Nextra. Follow Nextra and MDX conventions.

Examples: SDK usage examples; concept docs for accounts, quotes, solvers, trade flows; integration guides.

### `apps/storybook`

Preview and validate reusable UI, primarily from `packages/ui`.

### Tooling Packages

- `packages/eslint-config`: shared lint configuration only.
- `packages/typescript-config`: shared TypeScript configuration only.

Do not add product logic to tooling packages.

## Implementation Procedure

For any task that ports or derives behavior from vibe-ui:

1. **Locate the vibe-ui flow.** Search `src/services`, `src/callbacks`, `src/stores`, `src/checker`, `src/hooks`, `src/constants`, and the route/component that uses the flow.

2. **Identify the domain boundary.** Separate pure domain logic, service calls, contract interaction, state synchronization, and presentation.

3. **Design the frontier API before writing code.** Decide what is public in `packages/core`, what is internal, which domain folder owns it, and what the app calls.

4. **Output a design proposal and stop.** See "Design Proposal Gate" below.

5. **After approval, implement in the correct package.** Core SDK logic and hooks → `packages/core`; generic UI → `packages/ui`; route composition → `apps/web`.

6. **Keep the first version narrow.** Build small, working SDK slices. Do not copy broad vibe-ui modules.

7. **Add tests proportional to risk.** Transaction builders, request builders, schemas, and pure calculations must have unit tests. UI and integration code may be tested more loosely.

8. **Add JSDoc to all new TypeScript interfaces.** Explain the purpose and important fields. Public SDK interfaces need usage-oriented documentation.

9. **Document the public surface.** When adding a public SDK API, add a short usage example in `apps/docs` or in a package-level comment.

## Design Proposal Gate

Before writing any implementation code for a non-trivial task, output a design proposal in the exact format below and **stop**. Do not create files, do not run write commands, do not continue to implementation. Wait for the user to reply with `approved`, `approved with changes: ...`, or feedback.

Read-only exploration (viewing files, searching the repo, reading vibe-ui) is allowed and encouraged before writing the proposal.

### Required format

````
### Design Proposal: <short title>

**Goal**: one sentence describing what this slice delivers.

**Vibe-ui reference**: file paths in vibe-ui this derives from.

**Public API** (exports from `packages/core`, including React exports if any):
```ts
// signatures only, with JSDoc
```

**Internal modules**: list of new files and their responsibilities.

**Package placement**: which files go in core / ui / web and why.

**Out of scope**: what this slice deliberately does not cover.

**Open questions**: anything that needs the user's input.
````

### Exceptions (no proposal required)

Skip the design proposal only for:

- typo and comment fixes;
- formatting-only changes;
- dependency version bumps the user explicitly requested;
- edits to a single file under 20 lines that do not change any public API.

When in doubt, write the proposal.

## When Uncertain

- **Scope unclear (VibeCaps vs Majors, this phase vs later)?** Ask.
- **Package placement unclear (core vs ui vs web)?** Ask.
- **A vibe-ui pattern seems wrong for frontier?** Ask before copying.
- **Public API shape unclear?** Propose two options in the design proposal and let the user pick.

Do not guess on these. The cost of a question is small; the cost of unwinding the wrong architecture is large.

## Quality Bar

- Keep APIs small and names precise.
- Keep files cohesive; do not mix unrelated concerns in one module.
- Use typed request/response models. Do not use `any`.
- Validate external data at boundaries.
- Do not introduce app-wide global state into `packages/core`.
- Keep implementation increments reviewable (small, focused PRs).

## Completion Checklist

Before declaring a task done, run:

- `pnpm lint`
- `pnpm check-types`
- Any package-specific build or test commands that exist for the touched packages.

Report the output. If any of these fail, fix before declaring complete.

## Dependency And Repo Rules

- This repo uses pnpm and Turborepo.
- Do not use Yarn here, even though vibe-ui uses Yarn.
- Do not edit vibe-ui unless the user explicitly asks.
- Treat vibe-ui as read-only reference during frontier work.
- Preserve user changes in the worktree. Do not stash, reset, or discard uncommitted work.
- Do not perform unrelated refactors while implementing an SDK slice.

## Current Frontier Baseline

_Last updated: 2026-05-11. Update this section when the baseline materially changes._

- `apps/web` is mostly scaffold-level Next.js UI.
- `packages/ui` exposes a simple shared `Button`.
- `packages/core` exposes placeholder exports including `activeAccounts()`.
- `apps/docs` contains starter Nextra docs.

Expect to replace scaffolding gradually as SDK and product flows become real.

## Learned Rules

Rules added here come from real mistakes observed during agent work. Each rule should be one line and reference what went wrong.

_(none yet)_
