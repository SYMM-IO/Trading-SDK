# Review feedback — `<branch>`

Thanks for this PR. <One or two sentences on what it adds and what is good about it: design choices, docs, tests.>

This file lists the problems I'd like you to look at. It covers every High, Medium and Medium/Low problem from my review<, plus …>. Low items (docs wording, conventions, small performance issues) are left out and can be handled separately.

|                   |                                                                            |
| ----------------- | -------------------------------------------------------------------------- |
| **Branch**        | `<branch>` at `<sha>`                                                      |
| **Compared with** | `origin/main` at `<sha>` (<why this base>)                                 |
| **Scope**         | `<n>` commits · `<n>` files · about +`<n>` / −`<n>` lines                  |
| **In this file**  | `<a>` High · `<b>` Medium · `<c>` Medium/Low<, `<d>` SDK-boundary item(s)> |
| **Merge blocker** | **`<P#>`.** <What needs a decision, and by when.>                          |

The IDs match my full review, so some numbers are skipped.<Merged items, each with the reason, for example: "P6 also covers the PartyB path (P21 in the full review)">

## Summary

| ID                            | Severity | Problem | Suggested timing |
| ----------------------------- | -------- | ------- | ---------------- |
| [P1](#p1--high--<title-slug>) | High     | <…>     | **Before merge** |

Each item below has: where it is, what goes wrong, a before/after table, an example, a suggested fix, a test to add, and how sure I am.

---

## High

### P1 · High — <Title that states the defect>

**Where:**

- `path/to/file.ts:<lines>` (<symbol>)

**What goes wrong:** <precise mechanism, written for the author, who knows the code>.

|            | Before (`origin/main`) | After (this PR) |
| ---------- | ---------------------- | --------------- |
| <behavior> | <…>                    | <…>             |

**Example:**

1. <…>
2. <…>

**Suggested fix:**

- <…>

**Test to add:** <scenario → expected result>.

**Confidence:** <Confirmed / Confirmed by the docs / Likely, not verified>. <How: the code read, or the scratch test and its result.>

---

## Medium

<same item shape>

---

## Medium/Low

<same item shape>

---

## SDK boundary

### B1 · SDK boundary — <Title>

**Where:** `path/to/file.ts`.

| Hardcoded | Before (`origin/main`) | After (this PR) | Problem | Suggested change |
| --------- | ---------------------- | --------------- | ------- | ---------------- |
| <…>       | <…>                    | <…>             | <…>     | <…>              |

What is already right: <the part that is correctly left to the app or to the SDK>.

**Confidence:** <…>.

---

## How this was checked

- **Code:** <compared with `origin/main` at `<sha>`; contract docs used>.
- **Scratch tests:** <which items were reproduced; mocks only, outside the repo>.
- **Test suites:** <one line per package>.
- **Not run:** <lint, check-types, builds>, and anything reported by others but not re-run.
