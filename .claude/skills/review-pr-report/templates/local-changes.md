# Local changes — report pieces

Use these pieces when the target is **local changes** (see [SKILL.md → Local changes](../SKILL.md#local-changes)). Start from the mode's normal template (fast, medium or high), then apply the three steps below. Everything else in the template stays as it is, including the explain-first openings and any before/after table.

## 1. Replace the header

Title: `# Local Changes Review — <branch> (<scope>)`. Fast mode adds `(fast)` as in its template.

|                      |                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Changes**          | `<scope>` on `<branch>`: `<n>` commits not on `origin/main` · staged · unstaged · `<n>` new untracked files (drop what is empty) |
| **Snapshot**         | `HEAD <sha>` · fingerprint `<8 chars>` · `<YYYY-MM-DD HH:MM>`<; "files changed during the review: …" when the recheck differs>   |
| **Compared against** | `<base sha>` (`<the merge base with origin/main / HEAD>`; `<is local main stale?>`)                                              |
| **Size**             | `<n>` files changed (+`<n>` / −`<n>`) · `<n>` new files (+`<n>` lines)                                                           |
| **Packages touched** | `<list>`                                                                                                                         |
| **Intent**           | `<what the work is for>` (from `<the request / branch name / ticket / plan file / changeset>`, or "inferred from the code")      |
| **Excluded**         | `<files left out, and why; "none">`                                                                                              |
| **Review depth**     | `<Fast / Medium / High>` (about `<n>` minutes)                                                                                   |
| **Problems found**   | `<N>` (`<a>` High · `<b>` Medium · `<c>` Low) — medium and high only                                                             |
| **Verdict**          | **`<Ready for a PR / Ready after fixes / Not ready>`.** `<One or two sentences: what blocks it.>` — medium and high only         |

## 2. Change the wording

| In the template                                        | For local changes                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| "this PR", "the PR"                                    | "these changes"                                                            |
| "**What this PR adds:**"                               | "**What these changes add:**"                                              |
| "Before (`origin/main`)", "Before (`<base ref>`)"      | "Before (`<base sha>`)"                                                    |
| "After (this PR)"                                      | "After (these changes)"                                                    |
| Verdict "Merge / Merge after fixes / Do not merge"     | "Ready for a PR / Ready after fixes / Not ready"                           |
| "When to fix": "Before merge", "In this PR"            | "Before commit" (breaks the build or loses work), "Before PR", "Later"     |
| "New in this PR, or pre-existing?"                     | "New in these changes, or already on the base?"                            |
| "How it was compared" commit table (high)              | Only the branch commits in the scope; drop the table when there are none   |
| "**See it in apps/web:**" Setup "`gh pr checkout <n>`" | "your checkout as it is" (rebuild the SDK first when `packages/*` changed) |
| Next steps / Part 4 rows "Before merge", "In this PR"  | "Before commit", "Before PR", "Later"                                      |

## 3. Add "Ready for a PR?"

Every mode. Put it before "Next steps" (medium), before "Part 4 — Suggested plan" (high), or before "What this review did not do" (fast). Fast fills it from the file list and writes "not checked" where a row needs reading the code.

```md
## Ready for a PR?

| Check                                                | Status                             | Note                                     |
| ---------------------------------------------------- | ---------------------------------- | ---------------------------------------- |
| Changeset for SDK behavior changes (`.changeset/`)   | <Yes / Missing / Not needed>       | <package and bump, or why not needed>    |
| Docs for new or changed public API (`apps/docs`)     | <Yes / Missing / Not needed>       | <pages>                                  |
| Tests for the new behavior                           | <Yes / Partial / Missing>          | <what is not covered>                    |
| Prettier clean on the changed files                  | <Yes / No / not run>               | <files>                                  |
| Leftovers (debug logs, `.only` / `.skip`, new TODOs) | <None / Found>                     | <`path:line`>                            |
| Unused imports and variables                         | <None / Found>                     | <`path:line`>                            |
| Untracked files the change needs                     | <None / Listed>                    | <files that tracked code imports>        |
| Partly staged files                                  | <None / Listed>                    | <files with staged and unstaged changes> |
| `pnpm lint` / `pnpm check-types`                     | <Pass / Fail (n errors) / not run> | <command and scope>                      |
| Tests of the touched packages                        | <`n / n` pass / not run (why)>     | <package>                                |
```

## Re-running after fixes

When `local-review-<branch-slug>.md` already exists, the developer usually fixed something and asked again. Read the old file first, then:

- keep the problem IDs; new problems get new IDs (P7, P8…);
- move problems that are gone to a list right after the header, so the counts cover open problems only:

```md
## Fixed since the last run (<old snapshot sha / time>)

- **P2** (was Medium) — fixed: <how, `path:line`>.
- **P5** (was Low) — fixed: <how>.
```

- update the snapshot row, the counts, the verdict and "Ready for a PR?";
- in the reply, say what was fixed, what is still open and what is new.
