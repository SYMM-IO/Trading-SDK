Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`@symm-frontier/core` is the **framework-agnostic SDK** for SYMMIO. It owns the parts of the SDK that have no framework assumptions: ABI fragments, contract calls (read + write via viem clients), per-chain address registry, calculations, transformations, and typed errors.

A future React layer (`@symm-frontier/react`), Vue layer, or any other framework binding sits on top of this package and must not duplicate its logic.

## Architecture

This package follows **wagmi's shape**: a single immutable config, passed as the first argument of every standalone action, plus matching TanStack Query/Mutation option factories.

- **`createConfig` + standalone actions** are the canonical primitive. `createConfig({ getClient, getWalletClient?, chains?, defaultChainId? })` returns an immutable `Config`. Every action takes the config first: `getXyz(config, params)` (reads) / `doXyz(config, params)` (writes). The action resolves its viem client with `config.getClient({ chainId })` (or `config.getWalletClient({ chainId })` for writes) and its addresses with `config.getChainConfig(chainId)`.
- **Injected client resolvers.** The config does **not** create viem clients itself; the consumer/framework layer injects `getClient` / `getWalletClient`. `@symm-frontier/react` bridges these to wagmi's `getPublicClient` / `getWalletClient`; a plain Node script passes its own viem clients. This is why core stays framework- **and** wagmi-agnostic.
- **Query/mutation option factories** ship next to each action: `getXyzQueryOptions(config, options)` and `xyzMutationOptions(config)` return TanStack option bags (typed via `@tanstack/query-core`) with the `queryKey`, `queryFn`, and `enabled` filled in. Framework layers feed them straight into `useQuery` / `useMutation`.
- **`chainId` override pattern.** `params.chainId` is optional; when omitted, the config falls back to its `defaultChainId` (mirrors wagmi's `parameters.chainId ?? chainId`).
- **No connection state in core.** Which wallet is connected, and the active chain, belong to the framework layer. Core only ever receives resolvers and an explicit (or default) `chainId`.
- **Address registry** is built in per chain; `createConfig({ chains })` deep-merges per-chain overrides onto the defaults.
- **viem is a peer dependency** (never bundled). `@tanstack/query-core` is a runtime dependency used **only for types** in the option factories.

## Rules

- **No framework imports.** No React, Vue, or any framework. No browser-only globals at module scope (`window`, `document`, `localStorage`).
- **HTTP client**: axios. Use axios for all REST API calls in `packages/core`. Do not use native fetch.
- **API code generation**: Orval. Generate typed API clients from OpenAPI/Swagger specs. Config lives in `packages/core/orval.config.ts`. Run `pnpm generate-types` in `packages/core` to regenerate.
- **viem is the only crypto-stack dependency.** Do not introduce ethers, web3.js, or **wagmi** here — core stays wagmi-free so non-React framework layers can build on it. `@tanstack/query-core` is allowed (types only) for the query/mutation option factories.
- **Honor the Design Proposal Gate** for any non-trivial change to the public surface (see root `AGENTS.md`).
- **Every public export gets JSDoc** with purpose, parameters, return, and a short example for non-obvious APIs.
- **ABI fragments live under `src/abi/<version>/`.** The current version is `v0.8.5`. When we support a second version, add a sibling folder and route via the registry.
- **Address registry lives under `src/chains/`** — one file per contract family (e.g. `account-layer-addresses.ts`).
- **Config & shared helpers live at `src/` root:** `config/` (`createConfig`, `Config`, chain-config merge), `types/properties.ts` (parameter-helper types — `ChainIdParameter`, `Compute`, …), `types/query.ts` (`QueryParameter`, `SymmioQueryOptions`), and `query/utils.ts` (`filterQueryOptions`).
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
- Return raw viem types where possible; only introduce SDK-specific types when the contract output needs an enum/discriminant the consumer should not have to compute themselves.
- Throw `SymmError` (from `src/errors`) for SDK-level failures (unknown chain, missing config). Let viem's own errors pass through for on-chain failures.
