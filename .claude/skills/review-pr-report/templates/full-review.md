# PR Review — `<branch>` → `main`

> Self-contained review. You should not need to open any other file to understand what this PR does and what is wrong with it. Every term is explained in the [Glossary](#0-glossary) first.
>
> **How each section is written.** Every change (Part 1) and every problem (Part 2) has three layers. Read only as deep as you need:
>
> - **A. Summary for managers:** what changes for users and the business, in plain words.
> - **B. Technical view:** where it is in the code, and before vs after.
> - **C. Details:** examples, edge cases, docs, tests.

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

**Background.** <What this part of the product is, in one or two plain sentences.>

**Before vs after this PR:**

|                    | Before this PR                                   | After this PR                                   |
| ------------------ | ------------------------------------------------ | ----------------------------------------------- |
| <aspect, plain>    | <what apps or users had or did; "did not exist"> | <what they have or do now; "still …" + P# link> |
| What the user sees | <…>                                              | <… or **The same.**>                            |

**Business value:** <why a user or the business cares, in one or two sentences>.

**What stays the app's job:** <Anything the SDK deliberately leaves to the app.>

**Status in `<app>`:** <Does the real app use it today, or is this groundwork?>

**Risks introduced:**

- [P#](#p--severity--title-slug): <one line>.

#### B. Technical view

"Before" is `<the base ref, or the app's old code at <sha>>`; "after" is this PR.

| Area     | Before (`path:line`) | After (this PR, `path:line`) |
| -------- | -------------------- | ---------------------------- |
| <aspect> | <…>                  | <…>                          |

**New public exports:** `<list>`.

#### C. Details

**The same inputs, before and after:**

| Inputs              | Before       | After        |
| ------------------- | ------------ | ------------ |
| <one concrete case> | <old result> | <new result> |
| <an edge case>      | <old result> | <new result> |

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

### P1 · High — <Title that states the defect>

#### A. Summary for managers

- **What users see:** <the visible symptom>.
- **Why:** <one sentence, no code words>.
- **Business risk:** <impact, and how likely it is>.
- **Decision:** <fix before merge / in this PR / soon / cleanup>, and why.

#### B. Technical view

**Where:** `path/to/file.ts:<lines>`.

**Root cause:** <precise mechanism>.

|            | Before (`<base ref or the app's old code>`) | After (this PR) |
| ---------- | ------------------------------------------- | --------------- |
| <behavior> | <…>                                         | <…>             |

Add columns such as `Protocol` or `Suggested` when they help. Never drop `Before` or `After`.

#### C. Details

**Step-by-step example:**

1. <Concrete inputs and state>
2. <…>
3. <The wrong output>

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
