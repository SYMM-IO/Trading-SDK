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

"Before" is `<the base ref, or the app's old code at <sha>>`. Where nothing existed, write "did not exist" and what apps did instead. Mark a guess "(not checked)".

| Area   | Before                       | After                       | Visible to app users today? | Main files     |
| ------ | ---------------------------- | --------------------------- | --------------------------- | -------------- |
| <Area> | <plain words: how it worked> | <plain words: how it works> | <Yes: … / No (groundwork)>  | `path/to/dir/` |

<Terms a reader may not know, one line each, only if needed:>

- **<Term>:** <meaning>.

## Worth a closer look

Spotted while skimming. **Not checked**: each one may turn out to be fine.

1. **<Short label>.** <What looked risky, and why, in one or two sentences.> Before: <…>; after: <…>. (`path/to/file.ts`)
2. <…>

## What this review did not do

- No problem hunt beyond what stood out while skimming, and no severity ratings.
- No test runs, and no comparison with the reference app or the contract docs.
- <Anything else skipped>.

A **medium** review would check the risky areas in code and list Medium+ problems. A **high** review adds reproduction tests and the full report.
