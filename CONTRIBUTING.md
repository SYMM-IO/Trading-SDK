# Contributing to SYMM Frontier

Thanks for contributing. This guide covers local setup, day-to-day commands, and — most
importantly — **how we version changes with Changesets**.

For architecture, package boundaries (`core` vs `react`), and the full coding rules, read
[`AGENTS.md`](./AGENTS.md). This file is the human-facing contributor workflow; `AGENTS.md` is the
source of truth for conventions and is not duplicated here.

## Prerequisites

- **Node** `>= 20`
- **pnpm** `10.10.0` (pinned via `packageManager`). Use pnpm only — never `npm install` or `yarn`.

## Getting started

```bash
pnpm install        # install the whole workspace
pnpm dev            # turbo run dev across packages + apps (watch builds, next dev, storybook)
```

Common root scripts (all run through Turborepo):

| Command            | What it does                        |
| ------------------ | ----------------------------------- |
| `pnpm build`       | Build every package/app             |
| `pnpm lint`        | ESLint, zero warnings allowed       |
| `pnpm check-types` | `tsc --noEmit` across the workspace |
| `pnpm test`        | Run package tests (Vitest)          |
| `pnpm format`      | Prettier across the repo            |

Before opening a PR, make sure `pnpm lint`, `pnpm check-types`, and `pnpm test` pass.

## Commits

We use **[Conventional Commits](https://www.conventionalcommits.org/)**, enforced by `commitlint`
through a Lefthook git hook. Format:

```
<type>(optional scope): <description>

# examples
feat(quotes): add instant-close reconciliation
fix(react): stop re-subscribing on every render
docs: document the changeset workflow
chore: bump turbo
```

Commit messages are about _how the code changed_. Versioning and changelogs are handled separately,
by **changesets** (below) — the two are independent.

## Versioning with Changesets

We manage package versions with [**Changesets**](https://github.com/changesets/changesets). The idea
is simple: **a code change and a description of its version impact travel together in the same PR.**
You declare intent ("this is a patch to `core`") as a small file; tooling does the version bumping
and changelog writing later.

> **Current state:** versioning is set up; **publishing is not wired up yet.** Running the version
> step bumps `package.json` versions and writes `CHANGELOG.md` files locally — nothing is pushed to
> npm. Publishing (npm scope, CI, releases) is a separate, later step.

### Which packages this applies to

Versioning matters for the SDK packages that will eventually be published:

- `@symm-frontier/core`
- `@symm-frontier/react`
- `@symm-frontier/utils`
- `@symm-frontier/session-key`

`@symm-frontier/ui`, the config packages, and the apps (`web`, `docs`, `storybook`) are internal —
you usually don't add changesets for them.

### When do I need a changeset?

- **Yes** — any change to the behavior, API, types, or fixes of an SDK package.
- **No** — changes that don't affect a published package: docs, tests-only, CI, formatting, internal
  app/tooling tweaks. (When unsure, add one; an extra patch note is cheap.)

### How to add a changeset

After making your change, from the repo root:

```bash
pnpm changeset
```

The prompt walks you through:

1. **Select the packages** you changed (space to toggle, enter to confirm).
2. **Pick a bump type** for each (see below).
3. **Write a one-line summary** — this becomes the `CHANGELOG.md` entry, so write it for a _consumer_
   of the SDK, not for yourself.

This writes a file like `.changeset/funny-pandas-sleep.md`. **Commit it with your PR.** That's it —
you never edit `version` fields by hand.

A changeset file is just frontmatter + the summary:

```markdown
---
"@symm-frontier/core": minor
"@symm-frontier/react": patch
---

Add `getInstantCloses` and surface it through `useManagedQuotes`.
```

### Choosing a bump type (pre-1.0)

All SDK packages are pre-`1.0.0`, so [semver's pre-release rule](https://semver.org/#spec-item-4)
applies — **breaking changes go in a _minor_, not a major**, until we cut `1.0.0`:

| Bump    | Use when…                                                       | Example (pre-1.0) |
| ------- | --------------------------------------------------------------- | ----------------- |
| `patch` | Bug fix, internal change, no API change                         | `0.3.1 → 0.3.2`   |
| `minor` | New feature **or a breaking change** (while < 1.0)              | `0.3.1 → 0.4.0`   |
| `major` | Reserved for the eventual `1.0.0` and post-1.0 breaking changes | `0.x → 1.0.0`     |

### Independent versioning + internal-dependency cascade

Packages version **independently** — each one moves only on its own changes. But they depend on each
other (`react → core → utils`), so bumping a dependency **cascades a patch to its dependents** so
their pinned ranges stay current. Example: a patch to `utils` will also patch-bump `core` and
`react`. This is expected — you don't add changesets for the cascaded packages; tooling handles it.

### Applying versions (maintainers)

You normally don't run this — it's done at release time. To preview or apply:

```bash
pnpm changeset status --verbose   # show what's pending and how it would bump
pnpm version-packages             # consume changesets → bump versions + write CHANGELOG.md
```

`version-packages` deletes the consumed `.changeset/*.md` files, updates each `package.json`, and
(re)generates `CHANGELOG.md`. Review the diff and commit it. **No publish happens** — that step
doesn't exist yet.

### Quick reference

```bash
pnpm changeset            # author a changeset (do this in your feature PR)
pnpm changeset status     # see what's pending
pnpm version-packages     # maintainers: apply pending changesets locally
```
