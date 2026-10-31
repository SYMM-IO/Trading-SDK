# PR Review (fast) — `<branch>` → `main`

> **Fast review:** what this PR changes, from the description, the file list and a skim of the main files. Nothing here was verified in depth. For checked problems, ask for a medium or high review.

|                      |                                                                 |
| -------------------- | --------------------------------------------------------------- |
| **PR**               | `<#n "title">`, by `<author>`, `<state>`                        |
| **Branch**           | `<branch>` at `<sha>`                                           |
| **Compared against** | `<merge base or origin/main sha>` (`<one line: why this base>`) |
| **Size**             | `<n>` commits · `<n>` files · +`<n>` / −`<n>` lines             |
| **Packages touched** | `<list>`                                                        |
| **Review depth**     | Fast (about `<n>` minutes)                                      |

## In one paragraph

<Three to five plain sentences: what the PR adds or changes, who it is for, and whether real app users notice anything today.>

## What changes

Plain words, one row per area. Mark a guess "(not checked)".

| Area   | What it is, and what this PR changes                                                                                   | Visible to app users today? | Main files     |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------- |
| <Area> | <One or two sentences: what the feature is, then what the PR adds or changes; for a change to existing behavior, how.> | <Yes: … / No (groundwork)>  | `path/to/dir/` |

<Terms a reader may not know, one line each, only if needed:>

- **<Term>:** <meaning>.

## Worth a closer look

Spotted while skimming. **Not checked**: each one may turn out to be fine.

1. **<Short label>.** <What looked wrong, and why, in one or two plain sentences.> See it: <`/route` → action (not checked) / not visible in apps/web (why)>. (`path/to/file.ts`)
2. <…>

## What this review did not do

- No problem hunt beyond what stood out while skimming, and no severity ratings.
- No test runs, and no comparison with the reference app or the contract docs.
- <Anything else skipped>.

A **medium** review would check the risky areas in code and list Medium+ problems. A **high** review adds reproduction tests and the full report.
