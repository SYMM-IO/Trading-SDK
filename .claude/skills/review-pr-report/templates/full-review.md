# PR Review — `<branch>` → `main`

> Self-contained review. You should not need to open any other file to understand what this PR does and what is wrong with it. Every term is explained in the [Glossary](#0-glossary) first.
>
> **How each section is written.** Every change (Part 1) starts by explaining what the feature is. Every problem (Part 2) starts by telling what goes wrong and why. Then three layers; read only as deep as you need:
>
> - **A. Summary for managers:** the feature or the problem in plain words, and what it means for users and the business.
> - **B. Technical view:** where it is in the code, and how it works (or fails).
> - **C. Details:** an example, how to see it in apps/web, the fix, docs and tests.

|                      |                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| **Branch**           | `<branch>`                                                                                           |
| **Compared against** | `origin/main` @ `<sha>` (see [How it was compared](#how-it-was-compared))                            |
| **Size**             | `<n>` commits · `<n>` files · ≈ +`<n>` / −`<n>` lines                                                |
| **Packages touched** | `<list>`                                                                                             |
| **Problems found**   | `<N>` (`<a>` High · `<b>` Medium · `<c>` Low)                                                        |
| **Verdict**          | **`<Merge / Do not merge as-is>`.** `<One or two sentences: the blocker and what needs a decision.>` |

### The three things to read if you read nothing else

1. **`<P#>` — `<headline>`.** `<Two sentences: what breaks and when.>`
2. **`<P#>` — `<headline>`.** `<…>`
3. **`<P#>` — `<headline>`.** `<…>`

---

## What this PR is about

<Explain the feature before anything else, for a reader who has never heard of it. Plain words; define each term in the sentence.>

**The feature:** <What it is and how it works, in two to five sentences. A numbered list when it has steps or alternatives.>

**Why it exists now:** <The rule, request or problem that makes it needed, as stated by the code, the docs or the vendor. Never guess a motive.>

**A user's journey:** <Numbered steps of how a user goes through it end to end.>

**What this PR does:** <One or two sentences, pointing to the Part 1 areas (1.1, 1.2, …).>

**What it does not do:** <The gaps a reader should know first, linking the problems.>

---

## How it was compared

- `<Is local main stale? Which merged PRs a plain main...HEAD would wrongly include.>`
- This review uses `git diff origin/main...HEAD` (merge base `<sha>`), which is what GitHub shows for the PR.
- `<Untracked or unrelated folders that were ignored.>`

Commits in the PR, oldest first:

| #   | Commit  | Title   |
| --- | ------- | ------- |
| 1   | `<sha>` | <title> |

Lines changed by area:

| Area     | Files | + / −           |
| -------- | ----- | --------------- |
| `<area>` | `<n>` | +`<n>` / −`<n>` |

---

## 0. Glossary

Read this first if any of these words are unfamiliar.

| Term       | Meaning                                                                                 |
| ---------- | --------------------------------------------------------------------------------------- |
| **<Term>** | <One or two plain sentences. Only facts the code or docs state; never guess a purpose.> |

---

## Part 1 — What this PR changes

`<N>` areas. Start with the overview table, then read each area's A / B / C layers as deep as you need.

### Overview for managers

| #                      | Area   | In one sentence | Visible to app users today? | Problems |
| ---------------------- | ------ | --------------- | --------------------------- | -------- |
| [1.1](#11-<area-slug>) | <Area> | <…>             | <Yes: … / No (groundwork)>  | P1, P11  |

### 1.1 <Area name>

#### A. Summary for managers

**What it is:** <Explain the feature to someone who has never heard of it: what it is, why it exists, who uses it. Two to five plain sentences, no code names. Define each new term in the sentence where it first appears.>

<When the feature has steps, a short numbered flow:>

1. <First step, in product words.>
2. <…>

**What this PR adds:** <What the SDK now offers, in words. For a new feature, one sentence on how apps managed before ("Before this PR the SDK had no way to do this; apps called the contract by hand."). For a change to something that existed, say what changes and what users notice.>

**Business value:** <why a user or the business cares, in one or two sentences>.

**What stays the app's job:** <Anything the SDK deliberately leaves to the app.>

**Status in `<app>`:** <Does the real app use it today, or is this groundwork?>

**Risks introduced:**

- [P#](#p--severity--title-slug): <one line>.

#### B. Technical view

**Where:**

- <Piece, in a few words>: `path/to/file.ts:<line>`.
- <…>

<How the pieces work together, in two to four sentences, with code names.>

<Only when this PR changes behavior that already existed and a comparison is clearer than a sentence, add ONE before/after table. "Before" is `<the base ref, or the app's old code at <sha>>`. Skip it for a new feature; most Before cells saying "did not exist" means the table is not needed.>

|          | Before (`<base ref>`, `path:line`) | After (this PR, `path:line`) |
| -------- | ---------------------------------- | ---------------------------- |
| <aspect> | <…>                                | <…>                          |

**New public exports:** `<list>`.

#### C. Details

**Example:** <One concrete case, step by step: the inputs, and what happens now. Mention the old result only where it differs and the difference matters.>

1. <…>
2. <…>

**Docs:** <pages added or changed>.

**Tests:** <what is covered, and what is not>.

---

## Part 2 — Problems

Each problem uses the same three layers as Part 1:

- **A. Summary for managers.** What users or the business notice, why it happens in one sentence, and when it must be fixed.
- **B. Technical view.** Where it is, the root cause, and what changed compared with `origin/main`.
- **C. Details.** Background, a step-by-step example, the suggested fix, and how it was checked.

Severity scale:

- **High:** users hit it in normal use, or it blocks a core flow.
- **Medium:** wrong behavior in plausible situations.
- **Low:** an edge case, a performance issue, docs, or code conventions.

### Overview for managers

| #                             | The problem in plain words | Who notices | Severity | When to fix      |
| ----------------------------- | -------------------------- | ----------- | -------- | ---------------- |
| [P1](#p1--high--<title-slug>) | <…>                        | <…>         | High     | **Before merge** |

### P1 · High — <Title that states the defect in plain words>

#### A. Summary for managers

**The problem:** <Tell it as a short story, with no code words: what the user or the app is trying to do, what happens, and what should happen. Two to four sentences. A reader who stops here must understand the problem.>

**Why it happens:** <The mechanism in one to three plain sentences.>

- **Who notices:** <which users, in which flow, how often>.
- **Business risk:** <impact, and how likely it is>.
- **Decision:** <fix before merge / in this PR / soon / cleanup>, and why.

#### B. Technical view

**Where:** `path/to/file.ts:<lines>`. <New in this PR / pre-existing / moved from `<path>`.>

**Root cause:** <precise mechanism, with code names>.

<Only for a regression (it worked on the base and breaks now) or a changed behavior, add ONE before/after table. Skip it for a bug in new code. Add columns such as `Protocol` or `Suggested` when they help.>

|            | Before (`<base ref or the app's old code>`) | After (this PR) |
| ---------- | ------------------------------------------- | --------------- |
| <behavior> | <…>                                         | <…>             |

#### C. Details

**Step-by-step example:**

1. <Concrete inputs and state>
2. <…>
3. <The wrong output>

**See it in apps/web:**

- **Setup:** <PR: `gh pr checkout <n>` / local: your checkout as it is>; <`pnpm exec turbo run build --filter="@symmio/web^..."` when `packages/*` changed>; `pnpm --filter @symmio/web dev`; <wallet: real wallet for writes, or `NEXT_PUBLIC_E2E_MODE=1 NEXT_PUBLIC_E2E_ACCOUNT_ADDRESS=<address>` for read-only>; <account state needed>.
- **Steps:** open `http://localhost:3001/<route>` (`apps/web/src/features/<…>.tsx:<line>`) → <action, quoting the exact label> → <…>.
- **You see:** <the wrong result, and where: screen / Console / Network (request URL, count)>.
- **On `<base>`:** <what the same steps show before the change, or "the same" (pre-existing)>.
- **Status:** <Seen in apps/web / Steps from the code, not run / Not visible in apps/web: <why>, and instead: <scratch test command, SDK snippet or docs page>>.

**Fix:**

- <Smallest correct change>
- <Where else the same pattern exists>

**Test to add:** <a precise scenario, and what the existing test misses>.

**How it was checked:** **<Confirmed / Confirmed by the docs / Likely, not verified / Code-reviewed>.** <How: the code read, the scratch test and its result, or the docs page.>

---

## Part 3 — Test status

| Package | Result                 | Notes                                                           |
| ------- | ---------------------- | --------------------------------------------------------------- |
| `<pkg>` | **`<n>` / `<n>` pass** | <Failures, and whether they are caused by this PR; stale dist?> |

`<Commands to reproduce. What was not run: lint, check-types, builds.>`

---

## Part 4 — Suggested plan

| Priority                  | Item                       | Where             |
| ------------------------- | -------------------------- | ----------------- |
| **Must fix before merge** | P1: <fix in a few words>   | this PR           |
| **Decide before merge**   | <P#>: <the decision>       | <…>               |
| **Should fix in this PR** | <P#, P# (short fix names)> | this PR           |
| **Fix soon**              | <…>                        | follow-up tickets |
| **Cleanup**               | <…>                        | follow-up         |
