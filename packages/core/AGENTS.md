Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`@symm-frontier/core` is the **framework-agnostic SDK** for SYMMIO. It owns the parts of the SDK that have no framework assumptions: ABI fragments, contract calls (read + write via viem clients), per-chain address registry, calculations, transformations, and typed errors.

A future React layer (`@symm-frontier/react`), Vue layer, or any other framework binding sits on top of this package and must not duplicate its logic.

## Architecture

- **Free functions per slice** are the canonical primitive. A read is `function getXyz(client: PublicClient, params): Promise<T>`. A write is `function doXyz(client: WalletClient, params): Promise<Hash>`. Tree-shakable, idiomatic viem.
- **Action factories** bundle the free functions for `.extend()` ergonomics: `client.extend(accountLayerReadActions)` adds typed methods to a viem client without us inventing a new client abstraction.
- **Address registry** is built into the package per chain. Consumers can override the address per call via `{ accountLayerAddress: '0x...' }` for staging or new deployments.
- **No top-level state.** Everything is stateless and takes the client as a parameter. No global config, no module-level singletons.
- **viem is a peer dependency.** Consumers bring their own viem version; we never bundle viem.

## Rules

- **No framework imports.** No React, Vue, or any framework. No browser-only globals at module scope (`window`, `document`, `localStorage`).
- **viem is the only crypto-stack dependency.** Do not introduce ethers, web3.js, or wagmi here.
- **Honor the Design Proposal Gate** for any non-trivial change to the public surface (see root `AGENTS.md`).
- **Every public export gets JSDoc** with purpose, parameters, return, and a short example for non-obvious APIs.
- **ABI fragments live under `src/abi/<version>/`.** The current version is `v0.8.5`. When we support a second version, add a sibling folder and route via the registry.
- **Address registry lives under `src/chains/`** — one file per contract family (e.g. `account-layer-addresses.ts`).
- **Domain code lives under `src/<domain>/`** with this layout per slice:

  ```
  <domain>/
    reads/
      methods/
        <kebab-case-method-name>.ts          ← one file per read function
        <kebab-case-method-name>.test.ts
      actions.ts                             ← AccountLayerReadActions-style factory
      actions.test.ts                        ← factory-wiring tests
      index.ts                               ← sub-barrel (export * from ./actions; export * from ./methods/<name>)
    writes/
      methods/
        <kebab-case-method-name>.ts          ← one file per write function
        <kebab-case-method-name>.test.ts
      actions.ts                             ← AccountLayerWriteActions-style factory
      actions.test.ts
      index.ts
    types.ts                                 ← shared types/enums for the slice
    <shared-helper>.ts                       ← e.g. resolve-address.ts; flat at slice root
    index.ts                                 ← slice barrel (export * from ./reads; ./writes; ./types)
  ```

  - The read/write split is the axis viem already imposes (`PublicClient` vs `WalletClient`); group methods accordingly.
  - The `methods/` subfolder keeps `actions.ts` / `index.ts` scannable as the slice grows; never inline a method beside `actions.ts`.
  - If a slice currently has only reads or only writes, still use the same capability folder — the other simply doesn't exist yet.

- **Barrel re-export style:** `src/index.ts` (the package root) uses **explicit named re-exports** to curate the public surface. Every barrel below it (slice `index.ts`, capability `index.ts`) uses `export *` — the package root is the boundary, the lower barrels are plumbing.
- **Unit tests are colocated** (`foo.ts` ↔ `foo.test.ts`). Tests mock the viem client with `vi.fn()` — no real network in this slice.

## Public Surface

Re-export from `src/index.ts`. Sub-entries (`./abi`, `./account-layer`, `./chains`) are declared in `package.json` `exports` for tree-shaking. Add a new sub-entry when a domain grows large enough that consumers want to import it directly without pulling the umbrella.

## Coding Style

- Follow repo-wide rules (kebab-case filenames, `function` keyword at module scope).
- Function parameters use a `params` object except for the client (which is always positional first). This is for forward compatibility — new fields can be added without breaking call sites.
- Return raw viem types where possible; only introduce SDK-specific types when the contract output needs an enum/discriminant the consumer should not have to compute themselves.
- Throw `SymmError` (from `src/errors`) for SDK-level failures (unknown chain, missing config). Let viem's own errors pass through for on-chain failures.
