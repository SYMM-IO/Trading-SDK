---
name: write-jira-task
description: How to write a task/ticket for this project and file it to Jira. Use whenever the user asks to create, write, or define a task, ticket, or Jira issue. Cross-tool (Claude Code, Codex, Cursor) — plain Markdown.
---

# Writing a task and filing it to Jira

Playbook for turning a request into a well-formed task and (on approval) a Jira ticket.
Applies to SYMMIO Trading-SDK work and the Vibe-v2 → SDK migration. Tool-neutral.

## 1. Classify first: Vibe or SDK?

Before drafting, **ask the user whether the task is about Vibe (the app) or the SDK.**
This decides the title prefix:

- SDK task → title starts with `SDK - `
- Vibe task → title starts with `VIBE - `

## 2. Write at the requirement level — not a code map

Define **what** to achieve and how it's verified. Do **not** dig through the codebase to
produce `file:line` rip-out tables or "replace file X with Y" maps — finding the exact code
is the developer's job who picks up the ticket. Light read-only exploration to understand
the domain and name the SDK capability involved is fine; the deliverable is a task spec,
not a migration diff.

Explain migrations in **product-behavior and SDK terms**, not the reference app's internal
function/variable names.

## 3. Spec format

Use these sections, in order:

- **Context** — why this task exists, 1–3 lines.
- **Goal** — one sentence: the outcome.
- **Important** — genuinely load-bearing constraints, each stated **once** and flagged
  (invariants, gotchas, "must still hold"). Reference, don't repeat.
- **Requirements** (or **Work**) — what must be done, behaviorally.
- **Acceptance** — testable, behavioral criteria. Use Given/When/Then where behavior is
  conditional.

Rules for sections:

- **No "Out of scope" section.** The user dislikes it — omit it.
- **"Open questions" live in chat only.** Use them to resolve forks with the user before
  filing. **Never put an Open questions section in the Jira issue body.**
- Keep it tight. No redundant data. Mark something important rather than repeating it.

## 4. Approval gate

1. Draft the full spec **in chat** first.
2. **Wait for the user's explicit approval** (`approved`, or `approved with changes: …`).
3. Only then create the Jira issue. **Never auto-file.**

## 5. Filing to Jira (after approval)

- Project: **VIBE**. Board **620** backlog —
  https://symmio-vibe.atlassian.net/jira/software/c/projects/VIBE/boards/620/backlog
- Default issue type: **Task** (ask if it should be Story / Epic / Bug).
- Title carries the `SDK - ` or `VIBE - ` prefix from step 1.
- Body = **Context · Goal · Important · Requirements · Acceptance** only. Strip Open
  questions and any Out-of-scope text before filing.
- After filing, return the ticket link.

(Claude Code: the Atlassian MCP `createJiraIssue` tool. Codex/other: the equivalent Jira
API/MCP. cloudId for this site: `symmio-vibe.atlassian.net`.)

## 6. Communication style

Caveman mode is on by default in chat: drop articles/filler, fragments OK. **Ticket bodies
and titles stay normal, professional English** — the compression is for chat, not the
deliverable.
