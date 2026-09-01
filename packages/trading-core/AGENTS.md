Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`@symmio/trading-core` is the **framework-agnostic SDK** for SYMMIO. It owns the parts of the SDK that have no framework assumptions: ABI fragments, contract calls (read + write via viem clients), per-chain address registry, calculations, transformations, and typed errors.

A future React layer (`@symmio/trading-react`), Vue layer, or any other framework binding sits on top of this package and must not duplicate its logic.

## Architecture

This package follows **wagmi's shape**: a single immutable config, passed as the first argument of every standalone action, plus matching TanStack Query/Mutation option factories.

> [`ARCHITECTURE.md`](./ARCHITECTURE.md) is the companion to this section. It covers how the SDK absorbs **vendor change** — the one-contract-version-per-release doctrine and the multi-solver registry — and is required reading before adding a solver, upgrading the contracts version, or wiring a vendor integration.

- **`createConfig` + standalone actions** are the canonical primitive. `createConfig({ getClient, getWalletClient?, chains?, defaultChainId? })` returns an immutable `Config`. Every action takes the config first: `getXyz(config, params)` (reads) / `doXyz(config, params)` (writes). The action resolves its viem client with `config.getClient({ chainId })` (or `config.getWalletClient({ chainId })` for writes) and its addresses with `config.getChainConfig(chainId)`.
- **Injected client resolvers.** The config does **not** create viem clients itself; the consumer/framework layer injects `getClient` / `getWalletClient`. `@symmio/trading-react` bridges these to wagmi's `getPublicClient` / `getWalletClient`; a plain Node script passes its own viem clients. This is why core stays framework- **and** wagmi-agnostic.
- **Query/mutation option factories** ship next to each action: `getXyzQueryOptions(config, options)` and `xyzMutationOptions(config)` return TanStack option bags (typed via `@tanstack/query-core`) with the `queryKey`, `queryFn`, and `enabled` filled in. Framework layers feed them straight into `useQuery` / `useMutation`.
- **`chainId` override pattern.** `params.chainId` is optional; when omitted, the config falls back to its `defaultChainId` (mirrors wagmi's `parameters.chainId ?? chainId`).
- **No connection state in core.** Which wallet is connected, and the active chain, belong to the framework layer. Core only ever receives resolvers and an explicit (or default) `chainId`.
- **Address registry** is built in per chain; `createConfig({ chains })` deep-merges per-chain overrides onto the defaults.
- **viem is a peer dependency** (never bundled). `@tanstack/query-core` is a runtime dependency used **only for types** in the option factories.

### Per-solver endpoint divergence — normalize to a per-kind union

Different solver **kinds** serve the **same logical endpoint** with **different response shapes** — different fields, optionality, value types, and even which fields exist. The generated clients expose those raw shapes; the SDK's job is to hide that divergence behind **one stable, documented contract** so consumers never branch on vendor quirks. Most per-solver reads hit this, so normalize every one the same way.

**The shape of the pattern:** implement a **shared base type**, then one variant per solver that `extends` it and adds only that solver's exclusive fields plus a `kind` discriminant, and union the variants. Consumers narrow on `kind` to reach solver-specific data; a caller that targets a specific solver gets that variant directly. The raw vendor types stay internal.

**To add a new normalized per-solver endpoint:**

1. **Define the normalized types — a shared base + one variant per kind, unioned.** Write a base interface of the fields **every** kind returns; each kind's type `extends` it and adds a `kind` discriminant plus only that kind's exclusive fields; union them:

   ```ts
   interface BaseFoo {
     /* fields both solvers return */
   }
   export interface EnigmaFoo extends BaseFoo {
     kind: "enigma";
     /* Enigma-only fields */
   }
   export interface RasaFoo extends BaseFoo {
     kind: "rasa";
     /* Rasa-only fields */
   }
   export type Foo = EnigmaFoo | RasaFoo;
   export interface NormalizedFooByKind {
     enigma: EnigmaFoo;
     rasa: RasaFoo;
   }
   ```

   A kind-exclusive field lives on **that variant only** — never as an optional field on a shared shape (`uuid?`). Do this **even when the two shapes are nearly identical** (one extra field): still use base + variants, not one shape with `field?`. Hand-write them with field docs, keep them independent of the generated types, and **central** (one `types.ts` — the union has to see every variant, so it never splits per solver).

2. **Give each kind an adapter.** Under the action folder, add an `adapters/` directory with one module per kind (`adapters/enigma-<x>.ts`, `adapters/rasa-<x>.ts`). Each adapter owns that solver's whole fetch story for the endpoint — its client call(s) plus the mapping into the normalized shape (renaming, reconciling value-type conflicts, defaulting gaps, dropping unusable rows). All of one vendor's quirks live in its adapter, so solvers that diverge deeply — a different endpoint, several calls, distinct auth or paging — stay isolated from each other.
3. **Dispatch from the action.** The action is generic over the kind: it resolves the target solver and calls that kind's adapter (exhaustively — a new kind must fail to compile until its adapter is wired in), then returns the normalized shape. Targeting a specific solver narrows the return to that variant; omitting the solver returns the union.
4. **Carry the kind through** the query-options factory and the React hook so the narrowing reaches the caller.
5. **Keep raw shapes internal** — never re-export the generated types from the package root. Where a kind cannot serve the endpoint at all, fail with a typed error instead of dispatching.

The markets slice ([`src/solvers/markets/`](./src/solvers/markets/)) is the reference for this layout — normalized types central, one adapter per kind, thin dispatch. Cover each piece with tests: the adapters (mapping + fetch), the per-kind dispatch, and the return-type narrowing. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §3.2–3.3 for the `id === kind` model this builds on.

## Rules

- **No framework imports.** No React, Vue, or any framework. No browser-only globals at module scope (`window`, `document`, `localStorage`).
- **HTTP client**: axios. Use axios for all REST API calls in `packages/trading-core`. Do not use native fetch.
- **API code generation**: Orval. Generate typed API clients from OpenAPI/Swagger specs. Config lives in `packages/trading-core/orval.config.ts`. Run `pnpm generate-types` in `packages/trading-core` to regenerate.
- **viem is the only crypto-stack dependency.** Do not introduce ethers, web3.js, or **wagmi** here — core stays wagmi-free so non-React framework layers can build on it. `@tanstack/query-core` is allowed (types only) for the query/mutation option factories.
- **Honor the Design Proposal Gate** for any non-trivial change to the public surface (see root `AGENTS.md`).
- **Every public export gets JSDoc** with purpose, parameters, return, and a short example for non-obvious APIs.
- **ABI fragments live under `src/symmio-contracts/abi/v0.8.6/`** — the single contracts version this release supports. The folder name is a label, not a selection axis: there is deliberately **no** version registry and no version field in config; each SDK release supports exactly one contracts version. Upgrading contracts = swap the fragments in place in a new SDK release and fix the compile sweep (see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2).
- **Address registry lives under `src/core/chains/`** — `registry.ts` holds `CHAIN_CONFIGS` (one entry per chain, covering addresses, subgraphs, solver, price service, notifications, and Muon), with `types.ts` and `supported-chains.ts` alongside it.
- **Config & shared helpers:** `src/core/config/` (`createConfig`, `Config`, chain-config merge, config-key), `src/shared/types/properties.ts` (parameter-helper types — `ChainIdParameter`, `Compute`, …), `src/shared/types/query.ts` (`QueryParameter`, `SymmioQueryOptions`), and `src/shared/utils/query.ts` (`filterQueryOptions`).
- **Domain code lives under `src/<domain>/` with one folder per action.** Each action is a self-contained unit: action function, its TanStack option factory, any private sub-units (helpers, resolvers), and the action's `index.ts` barrel. Shared utilities used by ≥2 actions live at slice root.

  ```
  <domain>/
    <action-name>/                            ← one folder per action (kebab-case)
      <action-name>.ts                        ← getX(config, params) / doX(config, params)
      <action-name>.test.ts
      query.ts                                ← getXQueryOptions / xMutationOptions + getXQueryKey
      query.test.ts
      <sub-units>/                            ← optional — private helpers scoped to this action
        <helper>.ts
        <helper>.test.ts
        index.ts
      index.ts                                ← action-folder barrel (export * from "./<action-name>"; "./query"; …)
    <shared-utility>.ts                       ← optional — utilities used by ≥2 actions in this slice
    <shared-utility>.test.ts
    types.ts                                  ← shared types/enums for the slice
    index.ts                                  ← slice barrel (export * from each action-folder + shared utilities + ./types)
  ```

  - One folder per action (read or write). Reads use `config.getClient`; writes use `config.getWalletClient`. The action signature makes its kind clear — no `reads/` vs `writes/` split.
  - **Do not** split actions into a slice-wide `actions/` + `query/` folder pair (the legacy pattern). Group everything an action owns inside its own folder; share via slice-root files.
  - Private helpers (resolvers, calldata encoders, signing wrappers) that serve a single action live inside that action's folder. When the same helper is shared by ≥2 actions, lift it to the slice root.
  - Reference layout: `src/solvers/instant-open/` (one folder per `instant-open`, `prepare-instant-open-params`, `instant-open-auto`; shared `calldata.ts`, `eip712.ts`, `operations.ts`, `hedger-api.ts`, `trade-math.ts`, `types.ts` at slice root).

- **Barrel re-export style:** `src/index.ts` (the package root) uses **explicit named re-exports** to curate the public surface. Every barrel below it (slice `index.ts`) uses `export *` — the package root is the boundary, the lower barrels are plumbing.
- **Unit tests are colocated** (`foo.ts` ↔ `foo.test.ts`). Build a stub `Config` with `src/test/mock-config.ts` (its `getClient` / `getWalletClient` return `vi.fn()`-backed viem clients) — no real network in unit tests.

## Public Surface

Re-export from `src/index.ts`. Sub-entries (`./abi`, `./account-layer`, `./chains`) are declared in `package.json` `exports` for tree-shaking. Add a new sub-entry when a domain grows large enough that consumers want to import it directly without pulling the umbrella.

## Coding Style

- Follow repo-wide rules (kebab-case filenames, `function` keyword at module scope).
- The **`config` is the first positional argument** of every action and option factory; remaining inputs go in a `params` / `options` object (forward-compatible — new fields don't break call sites).
- Follow wagmi's type-naming convention: `{Name}Parameters`, `{Name}ReturnType`, `Get{Name}QueryOptions` / `...QueryKey` / `...Data`.
- Return raw viem types where possible; only introduce SDK-specific types when the contract output needs an enum/discriminant the consumer should not have to compute themselves. **Exception — solver REST endpoints:** when a per-solver endpoint's shape diverges by kind, normalize to a per-kind union instead of returning the raw generated type (see [Per-solver endpoint divergence](#per-solver-endpoint-divergence--normalize-to-a-per-kind-union)).
- Throw `SymmError` (from `src/errors`) for SDK-level failures (unknown chain, missing config). Let viem's own errors pass through for on-chain failures.
