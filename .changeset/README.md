# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It is how we
version and publish the SDK packages in this monorepo.

## What is a changeset?

A changeset is a small Markdown file describing a change and which packages it affects, plus the
release type (`patch` / `minor` / `major`). Changesets are accumulated on feature branches and
consumed at release time to compute the next version of each package and generate its changelog.

## Workflow

1. **While you work**, run `pnpm changeset` and answer the prompts. This writes a file under
   `.changeset/`. Commit it alongside your code change in the same PR.
   - Bump the package(s) you actually changed. Internal dependents (e.g. `@symmio/trading-react`
     depending on `@symmio/trading-core`) are bumped automatically per `updateInternalDependencies`.
   - Not every PR needs a changeset. Docs, tests, CI, and other non-published changes can skip it.

2. **On merge to `main`**, the release workflow opens (or updates) a **"Version Packages"** PR that
   applies every pending changeset: bumps versions, rewrites internal ranges, and updates changelogs.

3. **Merging that PR** publishes the changed packages to npm (after the manual approval gate on the
   `release` GitHub Environment).

## Which packages are published?

Everything that is not `"private": true`. Apps (`web`, `docs`, `storybook`) and `@symmio/ui` are
private and are never versioned or published by Changesets.

See the [Changesets docs](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)
for more.
