Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`apps/docs` is the **public documentation site** for the SDK, built with **Nextra**. It documents the public surface of `@symmio/trading-core` and `@symmio/trading-react` (and any future framework layer — Vue, Solid, etc.).

Every public API added to `core` or `react` must be reflected here:

- Method / hook / type signatures
- Inputs and outputs with descriptions
- Usage examples (working snippets)
- Conceptual prose explaining when and why to use the API
- Cross-links to related APIs and concepts

The bar is "a third-party developer can integrate the SDK without reading the source."

## Rules

- **Use Nextra's full feature set.** Categorize topics, use callouts, tabs, code groups, cross-links, anchored headings — whatever makes the reference clearer. Do not settle for a flat list of pages.
- **Organize semantically.** Group pages by domain (provider, wallet, trading, accounts, etc.), not by file layout.
- **Keep examples runnable.** Code samples should compile against the current public API. Update them when the API changes.
- **Mirror the SDK split.** Documentation for framework-agnostic APIs lives under the `core` section. Documentation for React hooks/providers lives under the `react` section. Do not duplicate prose across both — link instead.
- **Do not document private or internal APIs** unless the user explicitly asks.

## Writing Style

- Plain, direct prose. Prefer present tense and active voice.
- Lead each page with what the API is and when to reach for it. Reference docs come after the prose, not before.
- Keep code blocks tight: enough to demonstrate the API, no setup boilerplate that distracts from the point.
- Use MDX features (callouts, tabs) when they improve scannability — not as decoration.

## Out of Scope

- Internal architecture notes for agents and contributors. Those live in `AGENTS.md` files, not in `apps/docs`.
- Marketing copy for the product. This is developer documentation.
