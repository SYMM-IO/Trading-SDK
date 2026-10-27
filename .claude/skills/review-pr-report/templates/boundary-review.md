# SDK Boundary Review — Frontend Logic in the SDK

**Branch:** `<branch>` vs `origin/main`

**Rule checked:** the SDK (`trading-core`, `trading-react`, `session-key`) gives every frontend the same building blocks. If two frontends could reasonably solve something in different ways (product behavior, UX choices, one app's assumptions), that logic belongs in the app, not the SDK. The reverse also holds: a fact about a deployment that every frontend needs belongs in the SDK, not in one app.

**Scope:** all `<n>` changed SDK source files: `<n>` in `session-key`, `<n>` in `trading-core`, `<n>` in `trading-react`. Tests, ABIs and generated files were skipped.

## Verdict

<One sentence.>

- **`<n>` item(s) cross the line:** <IDs>.
- **`<n>` item(s) are borderline:** <IDs>.
- **`<n>` item(s) go the opposite way:** <IDs>.

---

## Crosses the line

### P1 — <Title>

**File:** `path/to/file.ts`

**What it is:** <what the code does, and where it came from (for example "moved from apps/web unchanged")>.

|                | Before (`origin/main`)                   | After (this PR)  | Suggested                  |
| -------------- | ---------------------------------------- | ---------------- | -------------------------- |
| Where it lives | <app / SDK / did not exist, `path:line`> | <…, `path:line`> | <app / SDK, neutral input> |
| Who decides    | <…>                                      | <…>              | <…>                        |

**Why it is frontend logic:**

1. <reason, quoting the code or comment>
2. <…>

**Fix (pick one):**

- **<Keep it in the SDK, but make it neutral>.** <how>
- **<Or move it back to the app>.** <what the SDK docs then say>

---

## Borderline: fixed policy values a frontend may want to choose

### B1 — <Title>

**File:** `path/to/file.ts`

| Hardcoded thing | Before (`origin/main`) | After (this PR) | Why it is a problem | <Fix> |
| --------------- | ---------------------- | --------------- | ------------------- | ----- |
| <…>             | <…>                    | <…>             | <…>                 | <…>   |

<What is correctly placed already.>

---

## Opposite direction: logic every frontend needs, kept only in the app

### R1 — <Title>

**File:** `apps/<app>/src/…`

<Why it is a fact about the deployment, and any evidence that it has already gone stale.>

|                | Before (`origin/main`) | After (this PR) | Suggested          |
| -------------- | ---------------------- | --------------- | ------------------ |
| Where it lives | <apps/…, `path:line`>  | <…>             | <SDK registry / …> |

**Fix:** <move it into the SDK registry as a capability, or similar>.

---

## Clean: good examples of keeping the SDK neutral

- **<Feature>.** <How it leaves the decision to the app.>

---

## Summary

| ID  | Item | Type                  | Action |
| --- | ---- | --------------------- | ------ |
| P1  | <…>  | Frontend logic in SDK | <…>    |
| B1  | <…>  | Fixed policy          | <…>    |
| R1  | <…>  | SDK logic in the app  | <…>    |
