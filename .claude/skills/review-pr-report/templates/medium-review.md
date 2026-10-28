# PR Review — `<branch>` → `main`

> **Medium review:** what this PR changes, plus the Medium-and-above problems found in its risky areas. Each problem was checked by reading the code and comparing it with `main`; none was reproduced with tests. Low items are listed briefly at the end of Part 2.

|                      |                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **PR**               | `<#n "title">`, by `<author>`, `<state>`                                                       |
| **Branch**           | `<branch>` at `<sha>`                                                                          |
| **Compared against** | `<merge base sha>` (`<why this base; is local main stale?>`)                                   |
| **Size**             | `<n>` commits · `<n>` files · +`<n>` / −`<n>` lines                                            |
| **Packages touched** | `<list>`                                                                                       |
| **Review depth**     | Medium (about `<n>` minutes)                                                                   |
| **Problems found**   | `<N>` (`<a>` High · `<b>` Medium · `<c>` Low)                                                  |
| **Verdict**          | **`<Merge / Merge after fixes / Do not merge as-is>`.** `<One or two sentences: the blocker.>` |

## In short

- **What it does:** <one sentence>.
- **Who notices today:** <app users / developers only / nobody yet (groundwork)>.
- **Main risk:** <the worst problem in one sentence, or "none found">.
- **Before merge:** <the one or two things to do or decide>.

## What this PR is about

<Explain the feature before anything else, for a reader who has never heard of it. Plain words; define each term in the sentence.>

**The feature:** <What it is and how it works, in two to five sentences. A numbered list when it has steps or alternatives.>

**Why it exists now:** <The rule, request or problem that makes it needed, as stated by the code, the docs or the vendor. Never guess a motive.>

**A user's journey:** <Numbered steps of how a user goes through it end to end.>

**What this PR does:** <One or two sentences, pointing to the Part 1 areas (1.1, 1.2, …).>

**What it does not do:** <The gaps a reader should know first, linking the problems.>

## Glossary

| Term       | Meaning                                                  |
| ---------- | -------------------------------------------------------- |
| **<Term>** | <One plain sentence. Only facts the code or docs state.> |

---

## Part 1 — What this PR changes

| #                      | Area   | In one sentence | Visible to app users today? | Problems |
| ---------------------- | ------ | --------------- | --------------------------- | -------- |
| [1.1](#11-<area-slug>) | <Area> | <…>             | <Yes: … / No (groundwork)>  | P1, P3   |

### 1.1 <Area name>

**What it is:** <Explain the feature to someone who has never heard of it: what it is, why it exists, who uses it, and how it works. Two to five plain sentences. Add a short numbered flow when it has steps. Define each new term in the sentence.>

**What this PR adds:** <In words. For a new feature, one sentence on how apps managed before. For a change to something that existed, what changes. End with the business value.>

<Only when this PR changes behavior that already existed and a comparison is clearer than a sentence, add ONE before/after table. "Before" is `<the base ref, or the app's old code at <sha>>`. Skip it for a new feature.>

|          | Before (`<base ref>`)        | After (this PR)             |
| -------- | ---------------------------- | --------------------------- |
| <aspect> | <how it worked, `path:line`> | <how it works, `path:line`> |

- **New public API:** `<names>` (or "none").
- **Status:** <used by the real app today, or groundwork>.

---

## Part 2 — Problems

Severity:

- **High:** users hit it in normal use, or it blocks a core flow.
- **Medium:** wrong behavior in plausible situations.
- **Low:** an edge case, a performance issue, docs, or code conventions.

| #                             | The problem in plain words | Who notices | Severity | When to fix      |
| ----------------------------- | -------------------------- | ----------- | -------- | ---------------- |
| [P1](#p1--high--<title-slug>) | <…>                        | <…>         | High     | **Before merge** |

### P1 · High — <Title that states the defect in plain words>

**The problem:** <Tell it as a short story, with no code words: what the user or the app is trying to do, what happens, and what should happen. Two to four sentences.>

**Why it happens:** <The mechanism in one to three plain sentences.>

**Where:** `path/to/file.ts:<lines>`. <The root cause with code names, in one sentence. New in this PR, or pre-existing?>

<Only for a regression (it worked on the base and breaks now) or a changed behavior, add ONE before/after table. Skip it for a bug in new code.>

|            | Before (`<base ref>`) | After (this PR) |
| ---------- | --------------------- | --------------- |
| <behavior> | <…>                   | <…>             |

**Example:**

1. <Concrete input or state>
2. <What happens>
3. <What should happen>

**See it in apps/web:**

- **Setup:** <PR: `gh pr checkout <n>` / local: your checkout as it is>; <`pnpm exec turbo run build --filter="@symmio/web^..."` when `packages/*` changed>; `pnpm --filter @symmio/web dev`; <wallet: real wallet for writes, or `NEXT_PUBLIC_E2E_MODE=1 NEXT_PUBLIC_E2E_ACCOUNT_ADDRESS=<address>` for read-only>; <account state needed>.
- **Steps:** open `http://localhost:3001/<route>` (`apps/web/src/features/<…>.tsx:<line>`) → <action, quoting the exact label> → <…>.
- **You see:** <the wrong result, and where: screen / Console / Network (request URL, count)>.
- **On `<base>`:** <what the same steps show before the change, or "the same" (pre-existing)>.
- **Status:** <Seen in apps/web / Steps from the code, not run / Not visible in apps/web: <why>, and instead: <scratch test command, SDK snippet or docs page>>.

**Fix:** <the smallest correct change, and where else the same pattern exists>.

**Checked:** <Checked in code / Confirmed by the docs / Likely, not verified (and what would verify it)>.

---

### Also noticed (Low, not detailed)

- **P<n> · Low** — <label>: <one plain sentence: what goes wrong, and when>. See it: <`/route` → action / not visible in apps/web (why)>. `path/to/file.ts:<line>`
- <…>

---

## Checks run

| Check             | Result                             |
| ----------------- | ---------------------------------- |
| `<package>` tests | <`n / n` pass, or "not run (why)"> |

**Not done in a medium review:**

- no reproduction tests;
- areas outside `<risky areas>` were only skimmed;
- `<anything else skipped: lint, check-types, docs build, live calls>`.

## Next steps

| Priority         | Item                     |
| ---------------- | ------------------------ |
| **Before merge** | <P#: fix in a few words> |
| **In this PR**   | <…>                      |
| **Follow-up**    | <…>                      |

A **high** review would add reproduction tests, a full pass of every lens over every area, and the full A/B/C report.
