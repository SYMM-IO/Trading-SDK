Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`@symmio/session-key` is the framework-agnostic helper package for local EVM session keys. It owns key generation, import, runtime manager state, message/EIP-712 signing, and transfer payload helpers.

Applications own persistence, encryption, decryption, and browser storage. This package only defines the storage interface and manager behavior.

## Rules

- **No framework imports.** No React, Vue, DOM globals, `window`, `document`, or browser storage assumptions.
- **viem is a peer dependency**, never bundled.
- **No SYMMIO contract logic.** Contract calls, address registries, and ABI fragments live in `@symmio/trading-core`.
- **Every public export gets JSDoc** with purpose, parameters, return, and an example for non-obvious APIs.

## Layout

```
src/
  constants.ts
  session-key-manager.ts      + .test.ts
  transfer-payload.ts
  types.ts
  index.ts                    ← package barrel
```

## Coding Style

- Follow repo-wide rules: kebab-case filenames, `function` keyword at module scope, and small cohesive files.
- Keep storage generic. Do not add localStorage, IndexedDB, encryption, or decryption implementations here.
