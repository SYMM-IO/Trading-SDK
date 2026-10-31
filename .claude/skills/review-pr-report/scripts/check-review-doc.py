#!/usr/bin/env python3
"""Check review Markdown files written with the review-pr-report skill.

Checks, per file:
  - every in-page link `](#anchor)` resolves to a heading (GitHub slug rules);
  - with --layers: every `### P<n> ·` and `### <n>.<n>` section has
    `#### A.`, `#### B.` and `#### C.` subsections;
  - a header row "Problems found | N (a High · b Medium · c Low)" matches the
    problem headings plus "- **P<n> · Low** —" bullets (Medium/Low counts as
    Medium; Low/Medium and Low (design) count as Low);
  - explain first, in every mode: every `### <n>.<n>` change has
    "**What it is:**", every `### P<n> ·` problem has "**The problem:**" and
    "**Why it happens:**", and every boundary item (`### P1 —`, `### B1 —`,
    `### R1 —`) has "**What it is:**"; each comes before the section's first
    table (and, with --layers, sits in layer A);
  - tables only where they help, in every mode: a change, problem or boundary
    section has at most one before/after table (a header row naming both
    Before and After), and no before/after table has two thirds or more of
    its Before cells saying "did not exist", "none", "no API" or similar;
  - see it in apps/web, in every mode: every `### P<n> ·` problem has a
    "**See it in apps/web:**" note (in layer C with --layers) with a status
    (Seen in apps/web / Steps from the code, not run / Not visible in
    apps/web); every Low bullet and every fast "Worth a closer look" item
    has a "See it:" clause;
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
TABLE_SEPARATOR = re.compile(r"^\|(\s*:?-{3,}:?\s*\|)+\s*$")
# A Before cell that carries no information: the feature is new, so a table is not needed.
EMPTY_BEFORE = re.compile(
    r"^(did not exist|does not exist|didn't exist|not exist|none|no api|n/a|nothing|not available|[—–-])(\b|$|[.;,:])",
    re.I,
)
LOCAL_TITLE = re.compile(r"^# Local Changes Review", re.M)
LOCAL_READY = re.compile(r"^## Ready for a PR\?\s*$", re.M)
LOCAL_HEADER_ROWS = ("Snapshot", "Intent", "Excluded")
SEE_IT_NOTE = "**See it in apps/web:**"
SEE_IT_STATUSES = ("Seen in apps/web", "Steps from the code, not run", "Not visible in apps/web")
FAST_WORTH_A_LOOK = re.compile(r"^## Worth a closer look\s*$", re.M)
WHAT_IT_IS = "**What it is:**"
THE_PROBLEM = "**The problem:**"
WHY_IT_HAPPENS = "**Why it happens:**"


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


def cells(row: str) -> list[str]:
    """Split a Markdown table row on unescaped pipes."""
    parts = re.split(r"(?<!\\)\|", row.strip())
    return [part.strip() for part in parts[1:-1]]


def tables(section: str) -> list[tuple[list[str], list[list[str]]]]:
    """Return (header cells, body rows) for each Markdown table in the section."""
    lines = section.splitlines()
    out: list[tuple[list[str], list[list[str]]]] = []
    i = 0
    while i < len(lines) - 1:
        if lines[i].startswith("|") and TABLE_SEPARATOR.match(lines[i + 1].strip()):
            header = cells(lines[i])
            rows: list[list[str]] = []
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(cells(lines[i]))
                i += 1
            out.append((header, rows))
        else:
            i += 1
    return out


def before_after_tables(section: str) -> list[tuple[int, list[list[str]]]]:
    """Return (Before column index, body rows) for each table whose header names Before and After."""
    out: list[tuple[int, list[list[str]]]] = []
    for header, rows in tables(section):
        before = next((i for i, cell in enumerate(header) if "Before" in cell), None)
        if before is not None and any("After" in cell for cell in header):
            out.append((before, rows))
    return out


def empty_before_share(before: int, rows: list[list[str]]) -> float:
    values = [row[before] for row in rows if len(row) > before]
    if not values:
        return 0.0
    empty = sum(1 for value in values if EMPTY_BEFORE.match(value.replace("*", "").replace("`", "").strip()))
    return empty / len(values)


def first_table_at(section: str) -> int:
    match = re.search(r"^\|", section, re.M)
    return match.start() if match else len(section)


def check_explained(kind: str, ident: str, section: str, labels: tuple[str, ...], layers: bool) -> list[str]:
    """The explanation labels exist, come before the first table, and (with layers) sit in layer A."""
    errors: list[str] = []
    table_at = first_table_at(section)
    layer_a = layer_text(section, "A") if layers else section
    for label in labels:
        at = section.find(label)
        if at < 0:
            errors.append(f'{kind} {ident} has no "{label}" explanation')
        elif at > table_at:
            errors.append(f'{kind} {ident}: "{label}" comes after a table; explain first')
        elif layers and label not in layer_a:
            errors.append(f'{kind} {ident}: "{label}" is not in layer A')
    return errors


def check_tables(kind: str, ident: str, section: str) -> list[str]:
    """At most one before/after table, and never one whose Before side is mostly empty."""
    errors: list[str] = []
    found = before_after_tables(section)
    if len(found) > 1:
        errors.append(f"{kind} {ident} has {len(found)} before/after tables; keep at most one, where it helps")
    for before, rows in found:
        if empty_before_share(before, rows) >= 2 / 3:
            errors.append(
                f'{kind} {ident}: before/after table whose Before cells mostly say "did not exist"; write one sentence instead'
            )
    return errors


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

    # Explain first, and tables only where they help, in every mode.
    for ident, section in sections(body, CHANGE_HEADING):
        errors += check_explained("change", ident, section, (WHAT_IT_IS,), layers)
        errors += check_tables("change", ident, section)
    for ident, section in sections(body, PROBLEM_HEADING):
        errors += check_explained("problem", ident, section, (THE_PROBLEM, WHY_IT_HAPPENS), layers)
        errors += check_tables("problem", ident, section)
    for ident, section in sections(body, BOUNDARY_HEADING):
        errors += check_explained("boundary item", ident, section, (WHAT_IT_IS,), False)
        errors += check_tables("boundary item", ident, section)

    # See it in apps/web, in every mode.
    for ident, section in sections(body, PROBLEM_HEADING):
        note_in = layer_text(section, "C") if layers else section
        if SEE_IT_NOTE not in note_in:
            where = " in layer C" if layers else ""
            errors.append(f"problem {ident} has no \"{SEE_IT_NOTE}\" note{where}")
        elif not any(status in note_in for status in SEE_IT_STATUSES):
            errors.append(f"problem {ident}: apps/web note has no status ({' / '.join(SEE_IT_STATUSES)})")
    for line in re.findall(r"^- \*\*P\d+ · Low[^*]*\*\*.*$", body, re.M):
        if "see it:" not in line.lower():
            errors.append(f"Low bullet without a \"See it:\" clause: {line[:60]}…")
    worth = FAST_WORTH_A_LOOK.search(body)
    if worth:
        rest = body[worth.end():]
        nxt = re.search(r"^## ", rest, re.M)
        for item in re.findall(r"^\d+\. .*$", rest[: nxt.start()] if nxt else rest, re.M):
            if "see it:" not in item.lower():
                errors.append(f"\"Worth a closer look\" item without a \"See it:\" clause: {item[:60]}…")

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
