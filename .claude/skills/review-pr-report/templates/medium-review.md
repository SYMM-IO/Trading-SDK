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

<Two to four plain sentences: what this part of the product is, what was missing or wrong before, and what the PR changes. End with the business value.>

"Before" is `<the base ref, or the app's old code at <sha>>`. Where nothing existed, write "did not exist" and what apps did instead.

|                    | Before                       | After (this PR)             |
| ------------------ | ---------------------------- | --------------------------- |
| <aspect>           | <how it worked, `path:line`> | <how it works, `path:line`> |
| What the user sees | <…>                          | <… or **The same.**>        |

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

### P1 · High — <Title that states the defect>

**What goes wrong:** <two or three plain sentences: the symptom a user or developer sees, and why it happens.>

**Where:** `path/to/file.ts:<lines>`. <The root cause in one sentence. New in this PR, or pre-existing?>

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

- **P<n> · Low** — <label>: <one sentence>; before <…>, after <…>. See it: <`/route` → action / not visible in apps/web (why)>. `path/to/file.ts:<line>`
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
