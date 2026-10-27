#!/usr/bin/env python3
"""Check review Markdown files written with the review-pr-report skill.

Checks, per file:
  - every in-page link `](#anchor)` resolves to a heading (GitHub slug rules);
  - with --layers: every `### P<n> ·` and `### <n>.<n>` section has
    `#### A.`, `#### B.` and `#### C.` subsections;
  - a header row "Problems found | N (a High · b Medium · c Low)" matches the
    problem headings plus "- **P<n> · Low** —" bullets (Medium/Low counts as
    Medium; Low/Medium and Low (design) count as Low);
  - before and after, in every mode: every `### <n>.<n>` change, every
    `### P<n> ·` problem and every boundary item (`### P1 —`, `### B1 —`,
    `### R1 —`) has a table row naming both `Before` and `After`; every Low
    bullet says "before" and "after"; a fast review's "What changes" table has
    `Before` and `After` columns;
  - with --layers: every change section also has "**Before vs after this PR:**"
    (or "**Before vs after these changes:**" for local changes) in layer A and
    "before and after" in layer C;
  - a local-changes report (title "# Local Changes Review") has a
    "## Ready for a PR?" section and "Snapshot", "Intent" and "Excluded"
    header rows.

Usage:
  python3 check-review-doc.py [--layers] FILE [FILE ...]

Exits 1 when any check fails.
"""

from __future__ import annotations

import re
import sys
from collections import Counter

CODE_BLOCK = re.compile(r"```.*?```", re.S)
HEADING = re.compile(r"^(#{1,6}) (.+)$", re.M)
LINK = re.compile(r"\]\(#([^)\s]+)\)")
PROBLEM_HEADING = re.compile(r"^### (P\d+) · ([^—\n]+?) —", re.M)
# Medium reviews list Low items as one-line bullets: "- **P9 · Low** — label: …".
LOW_BULLET = re.compile(r"^- \*\*(P\d+) · (Low[^*]*)\*\*", re.M)
CHANGE_HEADING = re.compile(r"^### (\d+\.\d+) ", re.M)
# SDK-boundary items: "### P1 — …", "### B1 — …", "### R1 — …" (no severity dot).
BOUNDARY_HEADING = re.compile(r"^### ([PBR]\d+) — ", re.M)
HEADER_COUNT = re.compile(r"Problems found\**\s*\|\s*(\d+)\s*\((\d+) High · (\d+) Medium · (\d+) Low\)")
# A Markdown table row that names both sides of the comparison.
TABLE_ROW = re.compile(r"^\|.*$", re.M)
FAST_CHANGES = re.compile(r"^## What changes\s*$", re.M)
# Layer A of a change: "this PR" for a PR review, "these changes" for local changes.
BEFORE_AFTER_A = re.compile(r"\*\*Before vs after (this PR|these changes):\*\*")
LOCAL_TITLE = re.compile(r"^# Local Changes Review", re.M)
LOCAL_READY = re.compile(r"^## Ready for a PR\?\s*$", re.M)
LOCAL_HEADER_ROWS = ("Snapshot", "Intent", "Excluded")


def has_before_after_row(section: str) -> bool:
    return any("Before" in row and "After" in row for row in TABLE_ROW.findall(section))


def layer_text(section: str, name: str) -> str:
    """Return the text of `#### <name>.` up to the next `#### ` heading (empty when absent)."""
    match = re.search(rf"^#### {name}\..*$", section, re.M)
    if not match:
        return ""
    rest = section[match.end():]
    nxt = re.search(r"^#### ", rest, re.M)
    return rest[: nxt.start()] if nxt else rest


def github_slug(text: str) -> str:
    """Approximate GitHub's heading anchor: lowercase, drop punctuation, spaces → hyphens."""
    text = text.strip().lower()
    text = re.sub(r"[^\w\- ]", "", text)
    return text.replace(" ", "-")


def heading_slugs(body: str) -> set[str]:
    seen: Counter[str] = Counter()
    slugs: set[str] = set()
    for _, title in HEADING.findall(body):
        slug = github_slug(title)
        slugs.add(slug if seen[slug] == 0 else f"{slug}-{seen[slug]}")
        seen[slug] += 1
    return slugs


def bucket(severity: str) -> str:
    first = severity.strip().split("/")[0].split(" ")[0].lower()
    return {"high": "High", "medium": "Medium", "low": "Low"}.get(first, "Unknown")


def sections(text: str, pattern: re.Pattern[str]) -> list[tuple[str, str]]:
    """Return (id, section text up to the next ### or ## heading) for each match."""
    out: list[tuple[str, str]] = []
    for match in pattern.finditer(text):
        start = match.end()
        nxt = re.search(r"^#{2,3} ", text[start:], re.M)
        end = start + nxt.start() if nxt else len(text)
        out.append((match.group(1), text[start:end]))
    return out


def check(path: str, layers: bool) -> list[str]:
    text = open(path, encoding="utf-8").read()
    body = CODE_BLOCK.sub("", text)
    errors: list[str] = []

    slugs = heading_slugs(body)
    links = LINK.findall(body)
    for anchor in links:
        if anchor not in slugs:
            errors.append(f"broken link #{anchor}")

    problems = PROBLEM_HEADING.findall(body) + LOW_BULLET.findall(body)
    counts = Counter(bucket(sev) for _, sev in problems)

    if layers:
        for kind, pattern in (("problem", PROBLEM_HEADING), ("change", CHANGE_HEADING)):
            for ident, section in sections(body, pattern):
                missing = [layer for layer in ("A", "B", "C") if f"#### {layer}." not in section]
                if missing:
                    errors.append(f"{kind} {ident} missing layer(s) {', '.join(missing)}")
        for ident, section in sections(body, CHANGE_HEADING):
            if not BEFORE_AFTER_A.search(layer_text(section, "A")):
                errors.append(f"change {ident}: layer A has no \"**Before vs after this PR / these changes:**\" table")
            if "before and after" not in layer_text(section, "C").lower():
                errors.append(f"change {ident}: layer C has no \"The same inputs, before and after\" table")

    # Before and after, in every mode.
    for kind, pattern in (("change", CHANGE_HEADING), ("problem", PROBLEM_HEADING), ("boundary item", BOUNDARY_HEADING)):
        for ident, section in sections(body, pattern):
            if not has_before_after_row(section):
                errors.append(f"{kind} {ident} has no before/after table (a table row naming both Before and After)")
    for line in re.findall(r"^- \*\*P\d+ · Low[^*]*\*\*.*$", body, re.M):
        if "before" not in line.lower() or "after" not in line.lower():
            errors.append(f"Low bullet without before/after: {line[:60]}…")
    fast = FAST_CHANGES.search(body)
    if fast:
        header_row = TABLE_ROW.search(body, fast.end())
        if not header_row or "Before" not in header_row.group(0) or "After" not in header_row.group(0):
            errors.append('"What changes" table has no Before and After columns')

    if LOCAL_TITLE.search(body):
        if not LOCAL_READY.search(body):
            errors.append('local-changes report has no "## Ready for a PR?" section')
        for row in LOCAL_HEADER_ROWS:
            if not re.search(rf"^\|\s*\*\*{row}\*\*\s*\|", body, re.M):
                errors.append(f'local-changes report has no "{row}" header row')

    header = HEADER_COUNT.search(body)
    if header:
        total, high, medium, low = (int(g) for g in header.groups())
        actual = (len(problems), counts["High"], counts["Medium"], counts["Low"])
        if (total, high, medium, low) != actual:
            errors.append(
                f"header says {total} ({high} High · {medium} Medium · {low} Low), "
                f"headings give {actual[0]} ({actual[1]} High · {actual[2]} Medium · {actual[3]} Low)"
            )
    if counts["Unknown"]:
        errors.append(f"{counts['Unknown']} problem heading(s) with an unknown severity")

    summary = f"{path}: {len(links)} links, {len(problems)} problems"
    if problems:
        summary += f" ({counts['High']} High · {counts['Medium']} Medium · {counts['Low']} Low)"
    print(summary + (" — OK" if not errors else ""))
    for error in errors:
        print(f"  ✗ {error}")
    return errors


def main(argv: list[str]) -> int:
    layers = "--layers" in argv
    files = [arg for arg in argv if arg != "--layers"]
    if not files:
        print(__doc__)
        return 2
    failed = False
    for path in files:
        failed |= bool(check(path, layers))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
