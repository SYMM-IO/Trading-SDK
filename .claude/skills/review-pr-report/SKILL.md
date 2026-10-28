---
name: review-pr-report
description: Review a PR, a branch, or the developer's current local changes (uncommitted, staged, or everything not yet on main) and write the result to a Markdown file. Three modes — fast (a few minutes, what the PR changes), medium (default, about 10–15 minutes, changes plus checked Medium+ problems) and high (about 30–40 minutes, full self-contained report in three layers — summary for managers → technical view → details — with reproduced findings, plus optional SDK-boundary and author-feedback files). Use when the user asks to review a PR or branch, to review "my changes", "current changes" or "what I implemented" before committing or opening a PR, to "find problems in this PR", or wants a review doc to read or send to the author. Cross-tool (Claude Code, Codex, Cursor) — plain Markdown.
---

# Review a PR or local changes and write the report

Playbook for turning "review this branch" or "review my changes" into a Markdown document that a reader can understand **without opening any other file**. The method was built on the `feat/sdk-account-features` and PR #75 reviews (Oct 2026).

## Targets

Two things can be reviewed. Pick the target from the request.

| Target            | Ask with                                                                                                             | Compared                                                 | "After" is read from                      | Report file                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| **PR or branch**  | a PR URL or number, a branch name, "review this PR"                                                                  | the merge base with `origin/main` → the branch head      | `git show <ref>:<path>`                   | `pr-review-<branch-slug>.md`    |
| **Local changes** | "review my changes", "current changes", "what I implemented", "before I commit / open a PR", "uncommitted", "staged" | a base ([Local scope](#local-scope)) → the files on disk | the working tree (the index for `staged`) | `local-review-<branch-slug>.md` |

When the request names neither, run `git status --short`. If it lists changes other than review files (see [Local changes](#local-changes)), review the local changes; otherwise review the current branch as a PR.

Steps 0–10 apply to both targets. For local changes, read "the PR" as "the changes", `origin/main` as the scope's base, and "the branch head" as the files on disk. Where local changes need something different, the step says so.

## Modes

Pick the mode from the request. If none is named, use **medium**.

| Mode                 | Ask with                                     | Time      | Question it answers                          | Template                                                 |
| -------------------- | -------------------------------------------- | --------- | -------------------------------------------- | -------------------------------------------------------- |
| **fast**             | `fast`, `quick`, "just tell me what changed" | 3–5 min   | What does this PR change?                    | [templates/fast-review.md](templates/fast-review.md)     |
| **medium** (default) | `medium`, or no mode named                   | 10–15 min | What changes, and is anything clearly wrong? | [templates/medium-review.md](templates/medium-review.md) |
| **high**             | `high`, `full`, `deep`, "full report"        | 30–40 min | Everything, with proof                       | [templates/full-review.md](templates/full-review.md)     |

What each mode does:

|                        | fast                                                             | medium                                                                           | high                                                         |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Steps run (below)      | 1, 2 (skim), 7, 9, 10; local changes also run the extra lenses   | 1–7, 9, 10 (lighter, see each step)                                              | all                                                          |
| Reading                | PR description, file list, skim of the biggest or riskiest files | full code of the risky areas, compared with main                                 | every changed file, plus the reference app and contract docs |
| Agents                 | none                                                             | none under ~1,500 changed lines; otherwise at most 2, read-only, no tests        | one per area (usually 3–4)                                   |
| Problem hunt           | only what is obvious while skimming                              | the lenses in step 3, on the risky areas                                         | every lens on every area                                     |
| Verification           | none; items marked **Not checked**                               | read the exact code and compare with main; no reproduction tests                 | also scratch reproduction tests                              |
| Test suites            | none                                                             | touched packages only, if they already run in this checkout in about 2 minutes   | all touched packages, plus `check-types` and `lint`          |
| Problems in the report | up to 5 "worth a closer look" items, each with a "See it" clause | Medium and above in detail with the apps/web note; Low items as one-line bullets | every severity, each with A/B/C layers and the apps/web note |
| Optional files         | —                                                                | —                                                                                | SDK-boundary review, author feedback (when asked)            |

Rules for every mode:

- **Always write the report to a Markdown file.** Never answer with the review only in chat.
- **Say the target, the mode and the expected time at the start** ("Medium review of your local changes (branch commits + uncommitted), about 12 minutes"), so the user can stop a wrong choice early.
- **Label every finding with how it was checked.** Fast and medium never claim "reproduced".
- **Always show before and after.** Every change area and every problem shows, side by side, what existed before the PR and what the PR makes it. Use a table with `Before` and `After` columns. Never leave it out, in any mode or any document. See [Before and after, always](#before-and-after-always).
- **Show how to see each problem in apps/web.** Every problem says where and how to reproduce it in the running app, or why it cannot be seen there. See [See it in apps/web](#see-it-in-appsweb).
- **Upgrade instead of restarting.** When the user says "go deeper" or "go high" after a fast or medium review, reuse what was already read, keep the problem IDs, and rewrite the same file in the richer template.

## Before and after, always

The user asked for this on the PR #77 review (Oct 2026). Sections that described only the new code, or showed "before" only as code in layer B, were hard to follow.

**What "before" is.** Pick the first that applies, and name it above the table:

1. **The code existed in the SDK:** the base ref (`origin/main`, or the parent branch of a stacked PR), with `path:line`.
2. **The PR ports logic from an app:** the app's old code at the PR's stated parent commit, with `path:line`. Read it with `git show <sha>:<path>`, never from a newer branch.
3. **Nothing existed:** write "did not exist", then say what apps or users did instead (for example "each app summed floats inline"). An empty column is not allowed.

**What the table must show:**

- **Behavior, not only code.** Each row is one aspect: who computes it, which rule, units, edge cases.
- **A final "What the user sees" row** in plain-words tables. When nothing changes for users, write **"The same"** in bold. That is a finding in itself: the PR moved logic and did not change the result.
- **Old mistakes that carry over.** When the old code had a bug that the PR keeps, the After cell says "still …" and links the problem.

**Per mode:**

| Mode   | Change areas (Part 1)                                                                                                                                                                                                                            | Problems (Part 2)                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| fast   | The "What changes" table has `Before` and `After` columns (from the description and the skim; write "not checked" where it is a guess)                                                                                                           | Each "worth a closer look" item says "before: …; after: …"                                                     |
| medium | Each area has one before/after table, plain words, with `path:line` in the cells                                                                                                                                                                 | Each Medium+ problem has a before/after table; each Low bullet says "before …; after …"                        |
| high   | **A:** a "**Before vs after this PR:**" plain-words table. **B:** a before/after code table with `path:line` on both sides. **C:** a "**The same inputs, before and after:**" table that runs one set of inputs through the old and the new code | **B:** a table with `Before` and `After` columns; add columns such as `Protocol` or `Suggested` when they help |

Author feedback and the SDK-boundary review follow the same rule: every item has a table with `Before` and `After` columns.

The checker script in step 9 fails a section that has no row containing both `Before` and `After`.

## See it in apps/web

Every problem says how a reader can reproduce it and see it in `apps/web`, the SDK's reference app. The user asked for this in Oct 2026. A problem the reader can see on screen is easier to accept, and easier to re-test after the fix.

**Find the real screen. Never guess one.**

1. Find who calls the defective code: `grep -rn "<export name>" apps/web/src` (usually a hook from `@symmio/trading-react`).
2. Follow the imports up to a page. Routes are the folders under `apps/web/src/app/` (`apps/web/src/app/pools/page.tsx` is `/pools`); pages are thin wrappers around `apps/web/src/features/*`.
3. Quote buttons, tabs and fields exactly as the source writes them, and cite the component's `path:line`.

**When no page reaches the code,** the status is **Not visible in apps/web**. Say why (groundwork that apps/web does not call yet; it needs a vendor failure or a chain state the app cannot create; only other frontends hit it), then give the closest way to see it: the scratch test and its command (high), a few lines that call the SDK function, or the `apps/docs` page that demos it.

**The note** goes under each problem as "**See it in apps/web:**":

1. **Setup:** which code to run (PR: `gh pr checkout <n>` or the review worktree; local changes: the developer's checkout as it is), the SDK rebuild when `packages/*` changed, and the wallet and account state needed (for example "an account with one open position on Arbitrum").
2. **Steps:** the route, then the actions, numbered.
3. **You see:** the wrong result, and where: on screen, in the DevTools Console, or in the DevTools Network tab (request URL and count).
4. **On `<base>`:** what the same steps show before the change, or "the same" for a problem that already existed.
5. **Status:** **Seen in apps/web** (the reviewer ran the steps), **Steps from the code, not run**, or **Not visible in apps/web**. Never write "Seen" for steps that were not run.

**Running apps/web** (facts every note can rely on):

```sh
pnpm exec turbo run build --filter="@symmio/web^..."   # apps/web reads the SDK from dist: rebuild after any packages/* change
pnpm --filter @symmio/web dev                          # then open http://localhost:3001 (localhost, not 127.0.0.1)
```

- Restart the dev server after a rebuild.
- **Read-only flows without a real wallet:** start the dev server with `NEXT_PUBLIC_E2E_MODE=1 NEXT_PUBLIC_E2E_ACCOUNT_ADDRESS=<address>`, then click **Connect Wallet**. The app then offers only a mock connector that reports `<address>` as connected. Pick an address that has the state the problem needs.
- **Write flows** (open, close, deposit, any transaction): the mock cannot sign, so they need a real browser wallet (the app's normal `injected` connector). Say so in Setup.

**Per mode:**

| Mode            | The note                                                                                                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fast            | One clause per "worth a closer look" item: `See it: <route> → <action> (not checked)` or `See it: not visible in apps/web (<why>)`. The route comes from a grep only.                                                                                                      |
| medium          | Every Medium+ problem has the full note, usually **Steps from the code, not run**. Every Low bullet has one clause: `See it: <route> → <action>` or `See it: not visible in apps/web (<why>)`.                                                                             |
| high            | Every problem has the full note in layer C. For High problems in read-only flows, run the steps when the app runs here (a browser tool, or a throwaway Playwright script outside the repo) and mark them **Seen in apps/web**; otherwise **Steps from the code, not run**. |
| author feedback | Every item has the full note, copied from the review.                                                                                                                                                                                                                      |

SDK-boundary items are about where logic lives, not about runtime behavior, so they need no note.

## Local changes

For a developer who has just built something and wants a report before committing or opening a PR. The report pieces (header, wording, the "Ready for a PR?" table, re-runs) are in [templates/local-changes.md](templates/local-changes.md).

### Local scope

| Scope             | Ask with                              | Base                              | Includes                                                                        |
| ----------------- | ------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| **all** (default) | "my changes", "what I implemented"    | `git merge-base origin/main HEAD` | commits on this branch not yet on `origin/main` + staged + unstaged + untracked |
| **uncommitted**   | "uncommitted", "since my last commit" | `HEAD`                            | staged + unstaged + untracked                                                   |
| **staged**        | "staged", "what I'm about to commit"  | `HEAD`                            | the index only; read files with `git show :<path>`, not from disk               |

- On `main` with no local commits, **all** and **uncommitted** are the same.
- A path narrows any scope ("only apps/web" → add `-- apps/web` to every diff command).

### Local rules

- **Never touch the developer's work.** No `git add` (not even `-N`), `stash`, `reset`, `checkout`, `restore` or `commit`, and no edits to their files. Read only.
- **New files count.** Untracked files are often most of the work. List them with `git ls-files --others --exclude-standard`, count their lines with `wc -l`, and read them from disk.
- **Exclude what is not the work.** Always leave out this skill's own files (`pr-review-*.md`, `pr-feedback-*.md`, `pr-recheck-*.md`, `local-review-*.md`, `sdk-boundary-review.md`) and other files clearly unrelated to the work (notes, scratch files). Name them in the report's "Excluded" row. If a whole untracked folder may or may not be part of the work, ask before starting.
- **Find the intent.** There is no PR description. Use, in order: the user's request; the branch name and any ticket ID in it; plan or design-proposal `.md` files the developer saved; changesets in `.changeset/`. Name the source in the "Intent" row, or write "inferred from the code".
- **Pin a snapshot.** The developer may keep editing during the review. At the start, record `git rev-parse --short HEAD` and a fingerprint of the scope's diff plus the reviewed untracked files:
  ```sh
  { git diff <base>; cat <reviewed untracked files>; } | shasum | cut -c1-8   # staged scope: git diff --cached
  ```
  Recompute it before step 9. If it changed, re-read the changed files, or say in the "Snapshot" row that line numbers refer to the start of the review.
- **Tests run in the developer's checkout.** A worktree cannot see uncommitted work. Run read-only commands only, and ask before a build that would overwrite a `dist` the developer uses (step 6). Scratch reproduction tests still go outside the repo.
- **No secrets in the report.** Never quote keys, tokens or `.env` values that appear in the changes. Report them as a problem without the value; a secret about to be committed is **High**.
- **The developer is the reader.** Write the report to them. No author-feedback file. "When to fix" uses **Before commit** (breaks the build or loses work), **Before PR**, and **Later**.

### Extra lenses for local changes

Add these to step 3 in every mode. They are cheap: most come from `git status --short` and a search of the changed lines.

| Lens                   | What to look for                                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not committed together | A tracked file imports an untracked file: a commit of only tracked files breaks the build. A file both staged and unstaged (`MM` in `git status --short`): the staged part alone may not compile or pass. |
| Leftovers              | `console.log`, `debugger`, `.only` / `.skip` in tests, new `TODO` / `FIXME`, commented-out code, unused imports and variables.                                                                            |
| Ready for a PR         | A changeset for every SDK behavior change, an `apps/docs` page for new or changed public API, tests for new behavior, and Prettier-clean files (all required by `AGENTS.md`).                             |

## 0. Deliverables

| #   | File (repo root, untracked)     | When                                                                                                                                 | Template                                                                       |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | `pr-review-<branch-slug>.md`    | Always, in every mode (PR or branch target)                                                                                          | the mode's template (see [Modes](#modes))                                      |
| 1   | `local-review-<branch-slug>.md` | Always, in every mode (local changes target)                                                                                         | the mode's template + [templates/local-changes.md](templates/local-changes.md) |
| 2   | `sdk-boundary-review.md`        | High mode only, when the PR touches `packages/trading-core`, `trading-react` or `session-key` and the user asks for a boundary check | [templates/boundary-review.md](templates/boundary-review.md)                   |
| 3   | `pr-feedback-<branch-slug>.md`  | PR target only, when the user wants something to send to the PR author (from a medium or high review)                                | [templates/author-feedback.md](templates/author-feedback.md)                   |

- `<branch-slug>` is the branch name with `/` → `-` (for example `feat-sdk-account-features`).
- The report's header names the mode ("Review depth: fast / medium / high").
- Never commit, stage or push these files unless the user asks. Never edit implementation files during a review.
- The documents are written in **plain, normal English**, even when the chat style is terse (caveman mode applies to chat, not to the documents).

## 1. Pin what is being compared

1. **The base.** Local `main` is often stale:
   ```sh
   git fetch origin            # if the network allows; otherwise use the cached origin/main
   git rev-list --count main..origin/main
   ```
   If local `main` is behind, review `origin/main...HEAD` (the merge base GitHub shows). Say so in the report, and name the PRs or topics a plain `main...HEAD` would wrongly include.
2. **A remote PR (a GitHub URL or number).**
   - Fetch it without touching the user's checkout: `git fetch origin "+refs/pull/<n>/head:refs/remotes/origin/pr/<n>"`.
   - Read the title, description, author and base through `gh pr view`. If `gh` is missing, use `curl https://api.github.com/repos/<owner>/<repo>/pulls/<n>`, which works for public repos.
   - Diff from the merge base: `git diff $(git merge-base origin/main origin/pr/<n>)...origin/pr/<n>`.
   - **fast and medium** read files with `git show origin/pr/<n>:<path>`, with no checkout.
   - **high** (or medium when tests are wanted) uses a detached worktree in the scratchpad: `git worktree add --detach <scratchpad>/pr<n> origin/pr/<n>`, then `pnpm install --frozen-lockfile --prefer-offline`.
3. **The header facts:**
   - `git log --oneline <base>..<head>` → the commit table, oldest first;
   - `git diff --shortstat <base>...<head>` → files and lines;
   - `git diff --stat <base>...<head>` grouped by package or app → lines by area. Fast mode needs only the totals and the top areas.
4. **Unrelated folders.** Ignore untracked folders that are not part of the PR, and say that you did.
5. **Local changes.** Pick the scope ([Local scope](#local-scope)), then collect the facts without touching the checkout:
   ```sh
   git fetch origin                             # if the network allows
   git merge-base origin/main HEAD              # the base for scope "all"; HEAD for "uncommitted" and "staged"
   git status --short                           # staged (1st column), unstaged (2nd), untracked (??), partly staged (MM)
   git log --oneline <base>..HEAD               # branch commits in the scope ("all" only)
   git diff --shortstat <base>                  # tracked changes, base → files on disk ("staged": git diff --cached --shortstat)
   git diff --stat <base>                       # lines by area
   git ls-files --others --exclude-standard     # untracked files; drop the excluded ones, then wc -l the rest
   ```
   Then record the snapshot fingerprint ([Local rules](#local-rules)).

## 2. Understand every change

1. Group the work into 5–10 **areas by feature**, not by package (for example "session keys", "gasless retry keys", "new reads").
   - **fast:** derive the areas from the file list and the PR description (for local changes, the intent). Skim only the biggest or riskiest files, and stop there.
2. For each area, read the code, its JSDoc, the `apps/docs` pages, the changesets and the tests. Get the old version with `git show origin/main:<path>` (local changes: `git show <base>:<path>`, and the new version from disk) and note **before vs after** for every area; the report needs it ([Before and after, always](#before-and-after-always)).
   - When the PR ports logic from an app, also read the app's old code at the PR's stated parent commit (`git show <sha>:<path>`), and note its `path:line`. That old code is the "before".
   - **medium:** read fully only the risky areas: public API, money and amount math, auth and signing, concurrency, network and vendor calls. Skim the rest.
3. Note what users of the real app see **today**, as opposed to groundwork that only other apps or later work will use.
4. Read the PR's own planning docs, test reports and follow-up lists (local changes: the plan files found for the "Intent" row). They often name known gaps that shipped anyway, which makes a strong finding ("the follow-up list names it, yet the feature ships without it").
5. For on-chain behavior, read the perps-core docs (a local checkout, or `github.com/SYMM-IO/perps-core/tree/version_0.8.6/docs/v0.8.6`) and cite the page. **high** always does this. **medium** does it only when a finding depends on it.
6. Fan out read-only agents only as the mode allows:
   - **fast:** none.
   - **medium:** none under about 1,500 changed lines; otherwise at most 2. Tell them: read-only, no installs, no scratch tests, report Medium and above with `path:line`.
   - **high:** one per area. Agents that write scratch reproduction tests take 15–25 minutes each.
   - For local changes, give agents the scope, the base, and the excluded files, and tell them to read the new code from disk.
   - Verify what any agent reports yourself (step 4).

## 3. Hunt for problems

**fast:** skip, and note only what is obvious while skimming. **medium:** apply these lenses to the risky areas. **high:** apply every lens to every area. Each lens found a real problem in a reference review. For local changes, also apply the [extra lenses for local changes](#extra-lenses-for-local-changes) in every mode, fast included.

| Lens                             | What to look for                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lifecycle and concurrency        | Work redone on every mount or render. A check done before a lock and not repeated inside it. A generation or epoch bump when nothing changed.                                                                      |
| Promises vs code                 | Take every "never", "at most once", "within N seconds" or "strictly X" in the JSDoc and docs, and look for a code path that skips it (an early return, a special-case branch, async work before the clock starts). |
| Regressions vs main              | Code that moved or was split: compare old and new line by line. Removed guards, caches and comments that explained a guard.                                                                                        |
| Regressions vs the reference app | When the PR ports logic from an app, compare against the app's original. Dropped guards and changed matching rules (for example case-insensitive → exact) hide here.                                               |
| Identity and matching            | Lookups keyed on one field only (a key without a payload fingerprint). Address case: EVM is case-insensitive, Solana base58 is not.                                                                                |
| Numbers and units                | `parseFloat` or `Number` on 18-decimal amounts, unit guessing by size, truncation of fractional strings to `bigint`, and "unknown" turned into 0.                                                                  |
| Load                             | Unbounded `Promise.all` over RPC or HTTP. An all-or-nothing read combined with a burst. Pagination with no page limit.                                                                                             |
| New dependencies on the hot path | A new network call in a latency-sensitive flow. A new single point of failure. Behavior that a remote flag can switch on with no release.                                                                          |
| Hardcoded copies                 | Another team's policy, addresses, selectors or third-party URLs copied by hand. App config that has drifted from the SDK registry.                                                                                 |
| Earlier maintainer decisions     | Feedback on earlier PRs (often recorded in the consumer app's handbook) that this PR contradicts.                                                                                                                  |
| Docs drift                       | Docs vs vendor reality (the PR's own test reports), docs vs code, and examples that break the rule written next to them.                                                                                           |
| Release hygiene                  | A changeset for every behavior change. A sensible semver bump. Required new inputs or fields in a `minor` release.                                                                                                 |
| Repo rules                       | The Hard Rules and conventions in `AGENTS.md`, and any `AGENTS.md` inside the touched packages.                                                                                                                    |
| SDK boundary                     | Logic that two frontends could reasonably do differently belongs in the app. Facts about deployments belong in the SDK.                                                                                            |
| Tests                            | What the existing test really covers vs what its name claims. A delay injected at the wrong step is a common gap. Tests that assert the buggy behavior.                                                            |

## 4. Verify every finding before writing it

**fast:** skip, and mark every item **Not checked**. **medium:** do everything below except the reproduction tests. **high:** do all of it.

- **Read the exact code** and cite `path:line`.
- **Compare with `origin/main`** to classify the finding as new, pre-existing, or moved. Code that only moved is demoted and marked "not new".
- **Reproduce when you can (high only):**
  - write a scratch vitest test **outside the repo** (in the scratchpad or a temp dir) that imports the branch's modules and uses mocks;
  - run it with `pnpm --filter <pkg> exec vitest run --config <tmp>/vitest.config.ts`;
  - make the test assert the defective behavior, so a pass proves the bug.
- **Label each finding** with one of:
  - **Confirmed:** reproduced (high), or unambiguous in the code;
  - **Checked in code:** read and reasoned from the code, not run (the usual medium label);
  - **Confirmed by the docs:** the contract or vendor docs say so;
  - **Likely, not verified:** say what would verify it;
  - **Not checked:** spotted while skimming (fast).
- **Never invent anything:** UI elements, call arguments, numbers, or the purpose of a feature. If a fact needs a network call you did not make, write "not checked".
- **Write the apps/web note** for each finding ([See it in apps/web](#see-it-in-appsweb)): find the screen from the code, never from memory, and label its status.
- **Re-check every number at the end:** counts, durations, file totals, line numbers.
- **Input from another review:**
  - read its tests before running them;
  - verify each item the same way, and adopt only what holds up;
  - rate it on this skill's scale, and state where you disagree with its rating;
  - merge it into an existing item when it has the same root cause.

## 5. Severity

- **High:** users hit it in normal use, or it blocks a core flow.
- **Medium:** wrong behavior in plausible situations.
- **Low:** an edge case, a performance issue, docs, or code conventions.

A new core feature with no React path (no hook or hook input, so apps/web cannot use it under Hard Rule 6 and every React consumer must hand-roll it) is **at least Medium**, not "Low (design)". The user corrected this on PR #75 (P28).

That rule covers **reads and stateful flows** only: requests, cache, state, multi-step wallet flows. It does **not** cover pure synchronous functions (no request, no state). Those need no hook: third-party React apps import them from core, and apps/web can get a plain re-export from `@symmio/trading-react` (as for `calculateQuotePnl`) when it needs one. Do not report "no React path" for them. The user had P3 withdrawn on PR #77 for this reason.

Mixed ratings are allowed. In the header totals, `Medium/Low` counts as Medium, and `Low/Medium` or `Low (design)` count as Low. On the first write, sort by severity. Once the user has read the document, keep the IDs stable and append new ones (P19, P20…). Fast mode does not rate items.

## 6. Run the checks

**fast:** skip. **medium:** run the touched packages' tests only if this checkout already runs them in about 2 minutes; otherwise skip and say so in the report. **high:** run everything below.

For local changes, every mode except fast also runs `pnpm exec prettier --check <changed files>` (seconds), and every mode runs in the developer's checkout ([Local rules](#local-rules)).

- Run the tests of every touched package, and report the numbers.
- In a fresh worktree, build the workspace dependencies first (`pnpm exec turbo run build --filter="<pkg>..."`, plus `@symmio/eslint-config` for lint). Unbuilt shared packages such as `@symmio/utils` make hundreds of tests fail for reasons that have nothing to do with the PR.
- For each failure, find out whether it is caused by the PR:
  - Is it in a file the PR does not touch?
  - Is it caused by a local proxy or loopback restrictions (for example a 503 from `127.0.0.1`)?
  - Is the `dist` stale? Build core before running the React tests, and ask before overwriting a build the user may be using.
- Run `pnpm lint` and `pnpm check-types` when feasible. Otherwise, state in the report that they were not run.

## 7. Write the review

Write `pr-review-<branch-slug>.md` (local changes: `local-review-<branch-slug>.md`) from the mode's template. For local changes, apply [templates/local-changes.md](templates/local-changes.md) on top: its header, its wording, and the "Ready for a PR?" table. Rules for every mode:

- **Self-contained.** A reader who knows nothing about the PR needs only this file. Explain every domain term the first time it appears. Medium and high include a glossary.
- **Short sentences, one idea per bullet.** Use numbered steps for sequences, tables for before/after, and bold for the key word.
- **Say whether each change is visible in the real app today** or is groundwork.
- **Anchors use GitHub slugs:** lowercase, drop punctuation, spaces become hyphens. `### P3 · Medium — Key reuse` becomes `#p3--medium--key-reuse`.

Per mode:

- **fast** ([template](templates/fast-review.md)), about 40–100 lines:
  - a header;
  - "In one paragraph";
  - a table of areas with `Before` and `After` columns, and whether the change is visible today;
  - up to 5 "worth a closer look" items, each **Not checked**, each with a `See it:` clause;
  - "what this review did not do".
- **medium** ([template](templates/medium-review.md)), about 150–350 lines:
  - a header with the verdict and counts, then "In short";
  - a short glossary;
  - Part 1, the changes: an overview table plus one short block per area, each with a before/after table;
  - Part 2, the problems: an overview table, then a compact block per Medium+ problem (What goes wrong / Where / Before vs after / Example / See it in apps/web / Fix / Checked), and Low items as one-line bullets that keep their IDs, say "before …; after …" and end with a `See it:` clause (`- **P9 · Low** — label: before …; after …. See it: /pools → ….`);
  - the checks run, and the next steps.
- **high** ([template](templates/full-review.md)), the full report:
  - **three layers for every change (Part 1) and every problem (Part 2):**
    - **A. Summary for managers:** what users or the business notice, in plain words, why it happens in one sentence, and the decision needed. For a change, this layer has the plain-words "**Before vs after this PR:**" table, ending with a "What the user sees" row.
    - **B. Technical view:** where in the code, the root cause, and a before/after table with `path:line` on both sides, against the base (or the app's old code when the logic is ported).
    - **C. Details:** for a change, a "**The same inputs, before and after:**" table; for a problem, a step-by-step example, "**See it in apps/web:**", the fix, a test to add, and how it was checked.
  - **an overview table at the start of Part 1 and Part 2,** with anchor links, so a manager can stop after the tables.

## 8. The optional documents

- **SDK-boundary review** (high only, [template](templates/boundary-review.md)):
  - a short verdict;
  - "crosses the line" items (P…);
  - borderline fixed values (B…);
  - the opposite direction, logic every frontend needs that lives only in the app (R…);
  - a "clean" list of good examples;
  - a summary table;
  - every P, B and R item has a before/after table (where the logic lived, or what it hardcoded, before and after the PR).
- **Author feedback** (PR target only, from a medium or high review, [template](templates/author-feedback.md)):
  - only High, Medium and Medium/Low items, plus any boundary items the user names;
  - technical only, with no manager layer;
  - opens with thanks and what is good, then the merge blocker and a summary table;
  - each item has Where / What goes wrong / Before vs after (a table) / Example / See it in apps/web / Suggested fix / Test to add / Confidence;
  - items that share a fix are merged, and the merges are stated;
  - the IDs from the review are kept, with a note that some are skipped.

## 9. Quality gate before replying

```sh
pnpm exec prettier --write <files> && pnpm exec prettier --check <files>
# fast and medium (<report> is pr-review-<branch-slug> or local-review-<branch-slug>):
python3 .claude/skills/review-pr-report/scripts/check-review-doc.py <report>.md
# high:
python3 .claude/skills/review-pr-report/scripts/check-review-doc.py --layers <report>.md
python3 .claude/skills/review-pr-report/scripts/check-review-doc.py pr-feedback-<branch-slug>.md sdk-boundary-review.md
```

The script checks:

- that every `#anchor` link resolves;
- that a header "Problems found" count matches the problem headings;
- **before and after, in every mode:** every `### <n>.<n>` change, every `### P<n> ·` problem and every boundary item (`### P1 —`, `### B1 —`, `### R1 —`) has a table row with both `Before` and `After`; every Low bullet says "before" and "after"; a fast review's "What changes" table has `Before` and `After` columns;
- **see it in apps/web, in every mode:** every `### P<n> ·` problem has "**See it in apps/web:**" (in layer C with `--layers`) and a status; every Low bullet and every fast "worth a closer look" item has a `See it:` clause;
- with `--layers` (high): every `### P<n> ·` and `### <n>.<n>` section has A/B/C, and every change section has "**Before vs after this PR:**" (local changes: "**Before vs after these changes:**") in A and "before and after" in C;
- a local-changes report (title `# Local Changes Review`) has a "Ready for a PR?" section and "Snapshot", "Intent" and "Excluded" header rows.

Fix everything it reports.

## 10. Reply to the user

Keep the reply short:

- link the file, and name the mode and the time it took;
- the verdict and the merge blocker (medium and high); for local changes, "Ready for a PR / Ready after fixes / Not ready" and the "Before commit" items;
- the top three problems, or the top "worth a closer look" items (fast), each with the route where it shows in apps/web;
- which problems were **Seen in apps/web** and which have steps that were not run;
- the counts by severity (medium and high);
- what was not run or not verified;
- for local changes: the scope, the snapshot, and any excluded files.

Offer, in one line, the next mode up ("medium/high would also check X") and to publish the document as a private shareable page.

## Follow-up requests this skill expects

- **"Go deeper" / "go high":** upgrade in place, as described in [Modes](#modes).
- **"I don't understand section X":** rewrite only that section in the A/B/C layers first, and apply them everywhere only after the user approves.
- **"Explain item Y" or "how should a caller handle Z":** answer in chat with `path:line` references. Do not edit the documents unless asked.
- **"Check this other review":** follow the "Input from another review" rule in step 4, then update the counts, the overview tables, the plan, and the cross-links.
- **"Make a file for the author":** follow step 8 for the author feedback file.
- **"I fixed it, check again" (local changes):** re-run on the same `local-review-<branch-slug>.md`, as described in [templates/local-changes.md → Re-running after fixes](templates/local-changes.md#re-running-after-fixes).
- **"Now review it as a PR":** after the developer pushes, run the PR target; reuse what was read and keep the problem IDs.
