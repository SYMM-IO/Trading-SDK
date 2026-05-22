Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`apps/storybook` is the **Storybook host** for the workspace. It configures Storybook and serves the stories defined throughout the monorepo. It does **not** own the stories themselves.

## Rules

- **Stories are colocated with their source.** A `.stories.tsx` file lives next to the file it documents (e.g. `packages/ui/src/button.tsx` ↔ `packages/ui/src/button.stories.tsx`). Do not create a centralized `stories/` folder inside this app.
- **This app contains configuration only.** Storybook config (`main.ts`, `preview.tsx`, etc.), composition setup, and any addons live here. New stories belong in the package they describe.
- **Discovery via globs.** Storybook's `stories` glob points into `packages/**/src/**/*.stories.tsx` (and `apps/**/src/**/*.stories.tsx` if app-level previews are needed). When adding a new package, update the glob if it falls outside the existing pattern.
- **No business logic.** This app is a viewer; do not import or wrap SDK flows here. If a story needs SDK state, mock it locally in the story file.

## Coding Style

- Follow repo-wide rules (kebab-case files, `function` keyword at module scope).
- Story files are named `<source>.stories.tsx` and use CSF3 (`Meta`/`StoryObj`).
