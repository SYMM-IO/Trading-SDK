# SYMMIO Trading-SDK — Monorepo Agent Guide

Rules for AI coding agents (Claude Code, Cursor, Codex, etc.) working anywhere in this repository.

Subprojects under `apps/*` and `packages/*` may add their own `AGENTS.md`. Those rules apply **on top of** the ones in this file; they do not replace it.

@AGENTS.local.md

## Mission

SYMMIO Trading-SDK is an **SDK-first** workspace for SYMMIO. The underlying product is built by many vendors with different architectures and tools. Building UIs against that raw surface is complex, so we ship an SDK that hides the complexity behind a **simple, correct, reliable** API.

The SDK has two layers:

- **`packages/trading-core`** — the framework-agnostic SDK. Contract calls, API calls, GraphQL, calculations, transformations. No framework assumptions.
- **`packages/trading-react`** — a thin React layer on top of `core`. Stateful flows and framework-bound ergonomics (hooks, providers) that cannot live in `core` go here.

The split must keep `core` reusable so that **Vue, Solid, or other framework layers** can be added later without rewriting `core`.

Third-party developers will consume `@symmio/trading-core` and `@symmio/trading-react` to build their own UIs. Our own `apps/web` is one such consumer.

## Hard Rules

Non-negotiable. Violating any of them is a defect.

1. **Use pnpm.** Never run `yarn` or `npm install` in this repo. Every package in the workspace follows this.
2. **Stop and ask when anything is unclear.** Scope, package placement, intent, API shape, naming — if you are not sure, ask. Ask anything that helps you produce a correct result. Do not guess. The cost of a question is small; the cost of unwinding wrong work is large.
3. **Do not add new dependencies without a stated reason and explicit user approval.** This applies to runtime, dev, and peer dependencies in any package.
4. **All apps and packages are written in TypeScript.** Do not add `.js` source files to any package under `apps/*` or `packages/*`. Config files that conventionally ship as JavaScript (e.g. `postcss.config.js`, `next.config.*` when a project requires it) are the only exception; everything else — source, tests, scripts — must be TypeScript.
5. **`packages/trading-core` is framework-agnostic.** No React, Vue, or any other framework imports. No browser-only globals at module scope. If a flow needs framework state, put it in `packages/trading-react` (or a future framework layer), not in `core`.
6. **`apps/web` consumes hooks and providers from `@symmio/trading-react`, types and chain config from `@symmio/trading-core`.** Import runtime functionality (hooks, providers) from `react`. Import types, enums, and chain config (`SymmioSupportedChainId`, `getChainConfig`, etc.) from `core`. Do not re-export `core` types through `react`.
7. **Honor the Design Proposal Gate.** For any non-trivial work in `packages/trading-core` or `packages/trading-react`, output a design proposal and wait for explicit user approval before writing implementation code. See [Design Proposal Gate](#design-proposal-gate) below.

## Project Vocabulary

- **SYMM / SYMMIO** — the underlying trading protocol and product surface.
- **SYMMIO Trading-SDK** — this monorepo. The SDK and its consumers live here.
- **SDK** — `@symmio/trading-core` together with `@symmio/trading-react` (and future framework layers).
- **core** — `packages/trading-core`. Framework-agnostic SDK. Does not exist on disk yet; see [Current Package State](#current-package-state).
- **react** — `packages/trading-react`. React layer on top of `core`.
- **VibeCaps** — lowcap trading flow.
- **Vibe-ui** — separate reference repo: full Next.js UI built against the raw product surface. See [Reference Repos](#reference-repos).
- **Explorer** — separate reference repo: lower-level data display UI. Contains an **Inspector** section that is the closest existing analogue to the SDK boundary.
- **vendors** — the multiple teams that produce and manage the product data the SDK wraps. Specifics are not yet documented here; see [Vendors & Data Sources](#vendors--data-sources).

When a task says "this repo" it means SYMMIO Trading-SDK unless the user explicitly names another repo.

## Repository Layout

### `apps/`

- **`apps/web`** — the production app, the spiritual successor to Vibe-ui built on modern stack. Built with `@symmio/trading-react` (and `@symmio/ui` for design primitives). **Must not import `@symmio/trading-core` directly** (Hard Rule 6).
- **`apps/docs`** — Nextra documentation site. Documents every public API in `@symmio/trading-core` and `@symmio/trading-react`. Use Nextra's full feature set: detailed prose, categorization, cross-links, well-organized structure.
- **`apps/storybook`** — Storybook host. **Stories themselves live next to the code they document**, not inside this app. `.stories.tsx` files are colocated in their owning package (e.g. `packages/ui/src/button.stories.tsx`). This app only configures and serves them.

### `packages/`

- **`packages/trading-core`** — framework-agnostic SDK. Contract calls, API/GraphQL clients, calculations, transformations, typed errors, validation. **Does not exist on disk yet** — will be created from scratch.
- **`packages/trading-react`** — React layer on top of `core`. Hooks, providers, framework-bound flows. Currently contains throwaway scaffolding from a previous rename; will be rebuilt fresh once `core` exists. See [Current Package State](#current-package-state).
- **`packages/ui`** — design system / reusable UI primitives (Button, etc.) for `apps/web` and `apps/storybook`. **Not part of the SDK.** Consumers of `@symmio/trading-core` / `@symmio/trading-react` are not expected to depend on `@symmio/ui`.
- **`packages/eslint-config`** — shared ESLint config consumed by every workspace package.
- **`packages/typescript-config`** — shared TS config consumed by every workspace package.

### Current Package State

- `packages/trading-core` — **does not exist yet**. The folder will be created when implementation starts (after Design Proposal approval).
- `packages/trading-react` — exists but contents are **throwaway scaffolding** from a prior `core` → `react` rename. Will be rebuilt as a real React layer on top of `core`. Do not invest in the current files.
- `packages/ui` — exists and is kept as the design system.
- `apps/web`, `apps/docs`, `apps/storybook` — exist as scaffolding.

## Reference Repos

Both reference repos live outside this monorepo. Treat them as **read-only**. Never edit, create, or delete files in them while doing SYMMIO Trading-SDK work.

- **Vibe-ui** — primary source of truth for **end-to-end user flows** (quote → trade → confirm, account management, withdraw, etc.). Consult it to understand _what the user experience looks like_ and _which behaviors the SDK must enable_.
- **Explorer (with the Inspector section)** — primary source of truth for **raw data shapes, contract reads, and inspection patterns**. The Inspector section sits closer to the SDK boundary than the rest of Vibe-ui, so it is often the cleanest reference for what `core` should expose.
- **Perps-core contract docs v0.8.5** — primary source of truth for **contract semantics, account/virtual-account behavior, events, lifecycle rules, and migration details**. Canonical docs live at https://github.com/SYMM-IO/perps-core/tree/version_0.8.5/docs/v0.8.5. Before implementing or reviewing contract/ABI behavior, read the relevant doc file(s) and cite them in the design proposal or explanation.
- **SYMMIO docs (docs.symm.io)** — primary source of truth for **protocol concepts and the overall product model**: what SYMMIO is (a hybrid clearing house for permissionless derivatives), the solver-based peer-to-peer trading model, the roles of traders / frontends / solvers, the "Derivatives as a Service" integration story, and the canonical glossary. Canonical site at https://docs.symm.io/. Consult it for high-level understanding and shared vocabulary; defer to the perps-core contract docs for exact on-chain semantics.

For any slice, consult whichever reference fits the question. They are complementary, not ranked.

The user provides the local paths to these repos through the workspace's `additionalDirectories` or in the task itself.

## Workflow

### Design Proposal Gate

Before writing any implementation code for a non-trivial task in `packages/trading-core` or `packages/trading-react`, output a design proposal in the format below and **stop**. Do not create files, do not run write commands, do not continue to implementation. Wait for the user to reply with `approved`, `approved with changes: …`, or feedback.

Read-only exploration (viewing files, searching the repo, reading Vibe-ui or Explorer) is allowed and encouraged before writing the proposal.

#### Required format

````
### Design Proposal: <short title>

**Goal**: one sentence describing what this slice delivers.

**Reference**: file paths in Vibe-ui and/or Explorer this derives from.

**Public API** (exports from `@symmio/trading-core` and/or `@symmio/trading-react`):
```ts
// signatures only, with JSDoc
```

**Internal modules**: list of new files and their responsibilities.

**Package placement**: which files go in `core` / `react` / `ui` / `web` and why. Justify the core-vs-react split: explain why each piece is framework-agnostic or framework-bound.

**Docs impact** (`apps/docs`): always account for the documentation. Name the exact pages/sections that must change and the ones to add — new public exports need a reference entry, changed signatures/behavior need their existing page updated, and superseded APIs need a "prefer X" pointer. If a slice genuinely needs no docs change, say so explicitly and why. Never leave this blank.

**Out of scope**: what this slice deliberately does not cover.

**Open questions**: anything that needs the user's input.
````

Docs are part of every slice, not a follow-up. A proposal that ships new or changed public API without a matching `apps/docs` update plan is incomplete, and the implementation is not done until those doc pages exist and are updated (see the [`apps/docs` rules](./apps/docs/AGENTS.md) — "Every public API added to `core` or `react` must be reflected here").

#### Exceptions (no proposal required)

Skip the design proposal only for:

- typo and comment fixes;
- formatting-only changes;
- dependency version bumps the user explicitly requested;
- edits to a single file under 20 lines that do not change any public API;
- edits limited to `apps/docs` content (text/MDX), `apps/storybook` configuration, or `packages/ui` non-SDK primitives.

When in doubt, write the proposal.

### When to stop and ask

- **Scope unclear** (this phase vs later)? Ask.
- **Package placement unclear** (`core` vs `react` vs `ui` vs `web`)? Ask.
- **A Vibe-ui or Explorer pattern seems wrong for the SDK**? Ask before copying.
- **Public API shape unclear**? Propose two options in the design proposal and let the user pick.
- **Vendor specifics required and not documented**? Ask. Do not invent vendor names, URLs, or contract addresses.

### PR scope

- Keep increments small and reviewable. One SDK slice per change; do not bundle unrelated refactors.
- Preserve user changes. Do not stash, reset, or discard uncommitted work without an explicit ask.

## Coding Style

Repo-wide "handwriting". Applies to every package and app.

- **Name all files in kebab-case.** Use lowercase words joined by hyphens for every file in the repo, regardless of what the file exports. A component file is `button.tsx`, not `Button.tsx`; a hook file is `use-wallet-account.ts`, not `useWalletAccount.ts`. The export inside the file still follows its own convention (PascalCase for components, camelCase for hooks).

- **Use the `function` keyword at module scope.** Components, hooks, and any helper defined at module scope must be declared with `function`, not an arrow function bound to a `const`. Arrow functions are fine for inline callbacks, event handlers in JSX, and any function defined inside another function.

  ```ts
  // good
  export function useWalletAccount() {
    /* ... */
  }
  export function Button(props: Props) {
    /* ... */
  }
  function formatAmount(value: bigint) {
    /* ... */
  }

  // bad
  export const useWalletAccount = () => {
    /* ... */
  };
  export const Button = (props: Props) => {
    /* ... */
  };
  ```

- **Keep files small — but split by meaning, not by line count.** A file should hold one cohesive responsibility. Split a file when a clear boundary appears (a second concept, a reusable helper, an independent hook), not just because the line count has grown.

- **Name component props interfaces `Props` by default.** When the props type stays local to the component's file, call it `Props`. If the type is exported (consumed by another file), rename it to `{ComponentName}Props` so it is unambiguous at the call site.

  ```ts
  // local — not exported
  interface Props {
    label: string;
  }
  export function Button(props: Props) {
    /* ... */
  }

  // exported — name it after the component
  export interface ButtonProps {
    label: string;
  }
  export function Button(props: ButtonProps) {
    /* ... */
  }
  ```

- **Document every public SDK export.** Each exported function, hook, type, and interface in `@symmio/trading-core` and `@symmio/trading-react` must have JSDoc — purpose, parameters, return value, and a short usage example where the API is not self-evident. The goal is for IDE hover-tooltips to be useful on their own.

- **Do not break a string literal across multiple lines with `+` concatenation.** Keep the string on one line and let Prettier wrap the call site. If the message is genuinely too long to live on one line, use a template literal (backticks) — never glue two quoted fragments together with `+` just to dodge line length.

  ```ts
  // bad
  throw new SymmError(
    "viem client has no `chain` bound. Pass `accountLayerAddress` explicitly " +
      "or recreate the client with a `chain` set.",
  );

  // good — one literal; the formatter handles the wrap
  throw new SymmError(
    "viem client has no `chain` bound. Pass `accountLayerAddress` explicitly or recreate the client with a `chain` set.",
  );
  ```

- **Colocate Storybook stories with their source.** A `*.stories.tsx` file lives next to the file it documents (e.g. `packages/ui/src/button.tsx` ↔ `packages/ui/src/button.stories.tsx`). Do not collect stories into `apps/storybook`.

## Tooling

- **Package manager**: pnpm (workspace defined in `pnpm-workspace.yaml`).
- **Task runner**: Turborepo (`turbo.json`).
- **Common commands**, all run from the repo root:
  - `pnpm install` — install workspace dependencies.
  - `pnpm dev` — `turbo run dev` across packages that define it.
  - `pnpm build` — `turbo run build`.
  - `pnpm lint` — `turbo run lint`.
  - `pnpm check-types` — `turbo run check-types`.
  - `pnpm format` — Prettier across the repo.
- **Hooks**: Lefthook (`lefthook.yml`).
- **Commits**: Conventional Commits enforced by `commitlint`.
- **Formatter**: Prettier with `prettier-plugin-organize-imports` and `prettier-plugin-tailwindcss` (see `.prettierrc`).

### Completion checklist

Before declaring a task done, run the relevant subset of:

- `pnpm lint`
- `pnpm check-types`
- Any package-specific `build` / `test` commands for the touched packages.

Report the output. If any fail, fix before declaring complete.

**Every change must be `pnpm format`-clean.** The user runs `pnpm format` manually before committing, so any code you touch must already match Prettier's output (`.prettierrc` with `prettier-plugin-organize-imports` + `prettier-plugin-tailwindcss`) — correct indentation, quotes, trailing commas, import ordering, wrapped call sites. Do not hand-format in a way Prettier would rewrite. When unsure, run `pnpm format` (or `prettier --check` on the touched files) yourself and fix before declaring complete, so the user's manual `pnpm format` is a no-op.

## Vendors & Data Sources

> **TODO** — fill in vendor list and reference URLs.
>
> The product is composed of data from multiple vendors with different architectures and tools. Until this section is filled in, agents must **ask** before assuming any vendor specifics (names, endpoints, schemas, contract addresses, auth models). Do not invent them and do not derive them from training data.
>
> When vendor-specific behavior is needed for a slice and this section is empty, surface it as an open question in the Design Proposal.

## Learned Rules

One line each, added from real mistakes. Keep the lesson visible.

> See [`decision.md`](./decision.md) at the repo root for longer-form lessons from past mistakes — read it before adding a flow (invalidate the data it changes) or reading SDK data in React (use the hook, not the cache by hand).

- **Remove unused imports and variables.** After any edit, check that all imports and variables are still used; delete dead code immediately.
- **Do not make required action inputs optional in SDK query options.** If an action requires inputs, the matching `GetXOptions` / hook parameters must require them too; do not use `ExactPartial` or add `queryFn` missing-input guards unless the API is intentionally optional/disabled-by-missing-input.
- **Never use the words "Vibe", "VibeCaps", or "vibe" in SDK code or docs.** They are app-product branding and must not leak into framework-neutral packages. Use the project-vocabulary term **lowcap** (or describe the behavior neutrally, e.g. "lowcap trading flow", "lowcap isolation"). This applies to identifiers (function names, constants, types), JSDoc, comments, error codes, and user-facing strings in `packages/*` and `apps/*`. The only place "VibeCaps" may appear is the project vocabulary entry in `AGENTS.md`.
- **A named subpath export lives in three places — keep them in sync.** Adding or removing a `./<sub>` entry in a package that ships named subpath exports (today `@symmio/trading-react` and `@symmio/utils`; **not** `@symmio/trading-core`, which uses a single entry + `./*` wildcard) means editing all three: (1) `package.json` `exports`, (2) the `vite.config.ts` `entry` map — without its own entry a re-export-only sub-barrel gets hoisted away and no `dist/<sub>/index.js` is emitted, so the export dangles, and (3) the `scripts/verify-packages/published-smoke/` fixtures + `runtime-probe.mjs` `specs`, so the new path is type- and runtime-verified. Miss one and `verify-packages` either ships a broken export map or fails to cover it. See `scripts/verify-packages/published-smoke/README.md`.
