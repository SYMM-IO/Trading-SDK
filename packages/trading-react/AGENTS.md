Read alongside the repository-root `AGENTS.md`. Rules below apply on top of the root rules.

## Purpose

`@symmio/trading-react` is the **React layer on top of `@symmio/trading-core`**. It exposes hooks, providers, and any flow that needs framework state (React context, lifecycle, suspense) and cannot live in `core`.

What this package owns:

- React hooks that wrap `core` services and state machines.
- Providers (e.g. SDK provider, query/cache providers) needed to use the hooks.
- React-specific ergonomics around `core` types (selectors, derived hooks, suspense boundaries).
- JSDoc-quality documentation for every public export.

What this package does **not** own:

- Contract calls, API/GraphQL clients, transformations, calculations. Those live in `core`.
- Design system components (Button, Modal, etc.). Those live in `@symmio/ui`.
- Product screens or routes. Those live in `apps/web`.

## Architecture

This is the **implemented** React layer (no longer scaffolding). It mirrors wagmi's react package:

- **`SymmioProvider`** builds the core `Config` once (memoized over the host's stable wagmi config) and supplies it via context. Its viem-client resolvers are wagmi's `getPublicClient` / `getWalletClient` (from `wagmi/actions`) — **this is the only place the SDK touches wagmi.** Mount it inside the host's `WagmiProvider` and `QueryClientProvider`.
- **`useSymmioConfig(parameters)`** = `parameters.config ?? context` (mirrors wagmi's `useConfig`). **`useSymmioChainId()`** reads the connected chain from wagmi.
- **Hooks are thin.** Pattern: `const config = useSymmioConfig(parameters); const chainId = useSymmioChainId(); return useQuery(getXQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId }))`. Mutations use `useMutation(xMutationOptions(config))`. The query/mutation logic lives in `core`; the hook only wires config + chainId, error normalization, and cache invalidation.
- **Error normalization.** Every hook wraps the core `queryFn` / `mutationFn` and runs failures through `normalizeSymmError` → `SymmioRequestError` (discriminated by `kind`).
- **Invalidation.** `predicateMatch(coreQueryKeyFn, partial)` turns a core query-key factory into an `invalidateQueries` predicate that matches on a field subset (e.g. every subaccount query for one user, any chain).
- **Wagmi is a peer dependency.** Connection state (account, chain, wallet client) comes from the host's wagmi config; the SDK never creates its own. Non-trivial changes still honor the [Design Proposal Gate](../../AGENTS.md#design-proposal-gate).

## Public API

- Public entry is `src/index.ts`. Sub-entries (e.g. `./provider`, `./wallet`) are allowed when they make tree-shaking or grouping clearer; declare them in `package.json` `exports`. A new sub-entry must be kept in sync across three places — `package.json` `exports`, the `vite.config.ts` `entry` map, and the `scripts/verify-packages/published-smoke/` fixtures + `runtime-probe.mjs` — or the published export map breaks. See the [Learned Rules](../../AGENTS.md#learned-rules) entry.
- Every export must have JSDoc (purpose, params, return, short usage example for non-obvious APIs).
- Re-exporting types from `core` is fine; re-exporting whole `core` runtime modules is **not** — consumers that want raw `core` should depend on `core` directly. `react` exposes React-shaped APIs.

## Rules

- **Depend on `@symmio/trading-core`.** Do not duplicate `core` logic here. If you find yourself implementing a contract call or a calculation in `react`, stop — it belongs in `core`.
- **Peer-depend on React.** React is a `peerDependency`, not a direct dep, so consumers' React version wins.
- **No app-level globals.** No module-level mutable singletons, no calls that assume a specific provider mounted outside what this package itself sets up.
- **Hooks are framework-bound by definition.** That is the reason for this package's existence. Use them.

## Coding Style

- Hooks are named `useXxx` and live in files named `use-xxx.ts`.
- Providers are named `XxxProvider` and live in files named `xxx-provider.tsx`.
- Follow the repo-wide rules on kebab-case filenames, `function`-keyword declarations, and `Props` naming.
