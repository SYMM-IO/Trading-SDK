Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`@symmio/utils` is the **framework-agnostic helper layer** for SYMMIO SDK consumers. It owns helpers that don't fit `@symmio/trading-core` because they pull in non-viem runtime dependencies (Decimal.js today; more allowed as need arises), but that any consumer — React, Vue, Node script — would want.

Today the package ships:

- **Amount helpers** (`./amounts`): `formatTokenAmount`, `parseTokenAmount`, plus a `Decimal.js` bridge (`rawToDecimal` / `decimalToRaw`) for UI-side math.
- **Address helpers** (`./address`): `shortenAddress` and other small primitives.

## Rules

- **No framework imports.** Same rule as `@symmio/trading-core`. No React, Vue, DOM globals, or `window`/`document` at module scope.
- **viem is a peer dependency**, never bundled.
- **Decimal.js is a direct dependency** — the only reason this package exists separately from `core`. Keep its surface contained: every Decimal-using export lives under `./amounts` so deep-imports tree-shake cleanly.
- **No SYMMIO domain logic.** Contract calls, address registries, ABI fragments all live in `@symmio/trading-core`. If a helper depends on a SYMMIO contract or address, it belongs in `core`, not here.
- **Honor the Design Proposal Gate** for non-trivial additions to the public surface.
- **Every public export gets JSDoc** with purpose, parameters, return, and a short example for non-obvious APIs.

## Layout

```
src/
  amounts/
    format-token-amount.ts          + .test.ts
    parse-token-amount.ts           + .test.ts
    decimal-bridge.ts               + .test.ts
    index.ts                        ← sub-barrel
  address/
    shorten-address.ts              + .test.ts
    index.ts                        ← sub-barrel
  index.ts                          ← curated named re-exports (package root)
```

- **Barrel re-export style:** the package root (`src/index.ts`) uses **explicit named re-exports**; sub-barrels (`amounts/index.ts`, `address/index.ts`) use `export *`.
- **Tests are colocated** (`foo.ts` ↔ `foo.test.ts`) and run with `vitest` in the `node` environment.

## Coding Style

- Follow repo-wide rules (kebab-case filenames, `function` keyword at module scope).
- Parameters: positional for the primary value (e.g. `raw: bigint`, `value: string`, `address: Address`); secondary configuration goes in an `opts` object for forward compatibility.
- Return raw primitives where possible (`string`, `bigint`); only return `Decimal` from helpers whose explicit purpose is the Decimal bridge.
